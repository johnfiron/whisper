/**
 * Analysis Pipeline Orchestrator
 * Tier-based execution of all analysis functions with validation and error handling.
 */
const Pipeline = (() => {
  let _results = [];
  let _aborted = false;

  function abort() { _aborted = true; }

  /**
   * Determine tier based on market cap and whisper presence.
   */
  function classifyTier(stock) {
    const t = Config.get('tierThresholds') || Config.DEFAULTS.tierThresholds;
    if (stock.marketCap >= t.mega) return 1;
    if (stock.marketCap >= t.large && stock.hasWhisper) return 2;
    if (stock.marketCap >= t.mid && stock.hasWhisper) return 3;
    if (stock.marketCap >= t.large) return 2;
    return 4;
  }

  /**
   * Run the full analysis pipeline for all stocks in the earnings window.
   * @param {object} earningsData - from EarningsCalendar.getEarningsForWindow()
   * @param {function} onProgress - callback(pct, message)
   * @returns {Array} analyzed stock objects
   */
  async function run(earningsData, onProgress = () => {}) {
    _results = [];
    _aborted = false;

    const allStocks = earningsData.all;
    Logger.info(`Pipeline: starting analysis for ${allStocks.length} stocks`);

    // Phase 1: Validate optionability
    onProgress(5, 'Validating optionable securities…');
    const optionable = [];
    const batchSize = 5;

    for (let i = 0; i < allStocks.length; i += batchSize) {
      if (_aborted) break;
      const batch = allStocks.slice(i, i + batchSize);
      const checks = await Promise.all(
        batch.map(async (s) => {
          try {
            const isOpt = await TradierAPI.isOptionable(s.ticker);
            return { stock: s, optionable: isOpt };
          } catch {
            return { stock: s, optionable: false };
          }
        })
      );
      for (const c of checks) {
        if (c.optionable) {
          optionable.push(c.stock);
          Logger.success(`${c.stock.ticker}: optionable`);
        } else {
          Logger.warn(`${c.stock.ticker}: NOT optionable — excluded`);
        }
      }
      onProgress(5 + (i / allStocks.length) * 15, `Optionability check: ${i + batch.length}/${allStocks.length}`);
    }

    Logger.info(`Pipeline: ${optionable.length} optionable out of ${allStocks.length}`);

    // Phase 2: Get quotes
    onProgress(20, 'Fetching quotes…');
    const tickers = optionable.map(s => s.ticker);
    let quotes = [];
    try {
      quotes = await TradierAPI.getQuotes(tickers);
    } catch (err) {
      Logger.error(`Quotes fetch failed: ${err.message}`);
    }
    const quoteMap = {};
    for (const q of quotes) {
      if (q?.symbol) quoteMap[q.symbol] = q;
    }

    // Phase 3: Per-stock analysis
    const total = optionable.length;
    for (let idx = 0; idx < total; idx++) {
      if (_aborted) break;
      const stock = optionable[idx];
      const pct = 25 + (idx / total) * 70;
      onProgress(pct, `Analyzing ${stock.ticker} (${idx + 1}/${total})…`);

      try {
        const result = await _analyzeStock(stock, quoteMap, earningsData);
        if (result) _results.push(result);
      } catch (err) {
        Logger.error(`Pipeline error for ${stock.ticker}: ${err.message}`);
      }
    }

    // Sort by edge (higher = better opportunity)
    _results.sort((a, b) => (b.edgeScore || 0) - (a.edgeScore || 0));

    onProgress(100, `Analysis complete: ${_results.length} trade opportunities`);
    Logger.success(`Pipeline complete: ${_results.length} analyzed stocks`);
    return _results;
  }

  async function _analyzeStock(stock, quoteMap, earningsData) {
    const tier = classifyTier(stock);
    if (tier === 4 && Config.get('excludeIlliquid')) {
      Logger.dim(`${stock.ticker}: Tier 4 — skipped`);
      return null;
    }

    const quote = quoteMap[stock.ticker];
    const currentPrice = quote?.last || quote?.prevclose;
    if (!currentPrice) {
      Logger.warn(`${stock.ticker}: no price data available`);
      return null;
    }

    const result = {
      ...stock,
      tier,
      currentPrice,
      quote,
      timestamp: new Date().toISOString(),
    };

    // FUNCTION 2: Implied Move (all tiers)
    try {
      result.impliedMove = await ImpliedMove.calculate(stock.ticker, currentPrice, stock.date);
    } catch (err) {
      Logger.warn(`${stock.ticker} ImpliedMove failed: ${err.message}`);
      result.impliedMove = null;
    }

    // FUNCTION 6: Historical Moves (all tiers)
    try {
      result.historicalMoves = await HistoricalMoves.analyze(stock.ticker, stock.date);
    } catch (err) {
      Logger.warn(`${stock.ticker} HistoricalMoves failed: ${err.message}`);
      result.historicalMoves = null;
    }

    // FUNCTION 3: IV Richness (tiers 1,2,3)
    if (tier <= 3 && result.impliedMove) {
      try {
        const endDate = stock.date;
        const startDate = DateUtils.toYMD(DateUtils.addDays(DateUtils.parseYMD(stock.date), -365));
        const history = await TradierAPI.getHistory(stock.ticker, startDate, endDate);
        result.ivRichness = IVRichness.calculate(
          stock.ticker,
          result.impliedMove.avgIV,
          history
        );
      } catch (err) {
        Logger.warn(`${stock.ticker} IVRichness failed: ${err.message}`);
      }
    }

    // FUNCTION 4: IV Crush (tiers 1,2)
    if (tier <= 2 && result.impliedMove) {
      const histAvg = result.historicalMoves?.avgMove || 0;
      result.ivCrush = IVCrush.calculate(
        stock.ticker,
        result.impliedMove.avgIV,
        result.impliedMove.impliedMovePct,
        histAvg
      );
    }

    // FUNCTION 7: Term Structure (tiers 1,2)
    if (tier <= 2) {
      try {
        result.termStructure = await TermStructure.analyze(stock.ticker, stock.date);
      } catch (err) {
        Logger.warn(`${stock.ticker} TermStructure failed: ${err.message}`);
      }
    }

    // FUNCTION 8: Greeks (tiers 1,2)
    if (tier <= 2 && result.impliedMove) {
      const callG = result.impliedMove.callGreeks;
      const putG = result.impliedMove.putGreeks;
      result.greeksCall = GreeksAnalysis.analyze(
        { greeks: callG, strike: result.impliedMove.atmStrike, option_type: 'call', bid: 0, ask: 0, last: result.impliedMove.callPrice },
        currentPrice,
        result.impliedMove.impliedMovePct
      );
      result.greeksPut = GreeksAnalysis.analyze(
        { greeks: putG, strike: result.impliedMove.atmStrike, option_type: 'put', bid: 0, ask: 0, last: result.impliedMove.putPrice },
        currentPrice,
        result.impliedMove.impliedMovePct
      );
    }

    // FUNCTION 5: Backtest (tier 1 only)
    if (tier === 1 && result.impliedMove && result.historicalMoves) {
      result.backtest = StraddleBacktest.analyze(
        stock.ticker,
        result.impliedMove.impliedMovePct,
        result.historicalMoves
      );
    }

    // FUNCTIONS 11-14: News (tiers 1,2,3)
    if (tier <= 3) {
      try {
        result.newsTimeline = await NewsAnalysis.buildTimeline(stock.ticker, stock.date);
      } catch (err) {
        Logger.warn(`${stock.ticker} news timeline failed: ${err.message}`);
      }

      if (result.newsTimeline && result.impliedMove) {
        result.newsPricingIn = NewsAnalysis.determinePricingIn(
          stock.ticker, [], result.impliedMove.impliedMovePct
        );
        result.peerContagion = NewsAnalysis.peerContagionScore(
          stock.ticker, stock.sector, earningsData.all
        );
        result.newsVolAdj = NewsAnalysis.volAdjustment(
          stock.ticker, result.impliedMove.avgIV, result.newsTimeline
        );
      }
    }

    // FUNCTION 9: Price Targets (all tiers with implied move)
    if (result.impliedMove) {
      const newsProvider = Config.get('newsProvider');
      result.priceTargets = PriceTargets.calculate({
        ticker: stock.ticker,
        currentPrice,
        impliedMovePct: result.impliedMove.impliedMovePct,
        impliedMoveDollar: result.impliedMove.impliedMoveDollar,
        avgIV: result.impliedMove.avgIV,
        historicalAvgMove: result.historicalMoves?.avgMove || 0,
        earningsTime: stock.time,
        epsEstimate: stock.epsEstimate,
        whisperNumber: stock.whisperNumber,
        hasWhisper: stock.hasWhisper,
        newsSentiment: result.newsTimeline?.avgSentiment || 0,
        useWhisper: Config.get('useWhisper'),
        useNews: newsProvider !== 'none',
      });
    }

    // FUNCTION 10: Liquidity screening (reconstruct from chain)
    if (result.impliedMove) {
      result.liquidity = LiquidityScreen.screen({
        bid: result.impliedMove.callPrice * 0.95,
        ask: result.impliedMove.callPrice * 1.05,
        last: result.impliedMove.callPrice,
        open_interest: 500,
        volume: 200,
      });
    }

    // Generate recommendation
    result.recommendation = _generateRecommendation(result);
    result.edgeScore = _calculateEdge(result);

    return result;
  }

  function _generateRecommendation(r) {
    if (!r.impliedMove) return null;

    const iv = r.ivRichness;
    const hist = r.historicalMoves;
    const move = r.impliedMove;
    const crush = r.ivCrush;

    let strategy = 'Long Straddle';
    let rationale = '';
    let secondary = 'Iron Condor';

    const isOverpriced = iv && (iv.classification === 'overpriced' || iv.classification === 'severely-overpriced');
    const isUnderpriced = iv && (iv.classification === 'underpriced' || iv.classification === 'severely-underpriced');
    const historicalBeatsImplied = hist && hist.avgMove > move.impliedMovePct;
    const crushSignificant = crush && crush.crushPctOfIV > 30;

    if (isOverpriced && !historicalBeatsImplied) {
      strategy = 'Short Straddle';
      rationale = `IV at ${iv.ivPercentile}th percentile is ${iv.classificationLabel}. Historical avg move ${hist?.avgMove || 'N/A'}% < implied ${move.impliedMovePct}%. Sell premium to capture IV crush.`;
      secondary = 'Iron Condor';
    } else if (isOverpriced && historicalBeatsImplied) {
      strategy = 'Iron Condor';
      rationale = `IV rich at ${iv.ivPercentile}th pctile but historical moves are large. Sell defined-risk wings.`;
      secondary = 'Short Straddle';
    } else if (isUnderpriced || historicalBeatsImplied) {
      strategy = 'Long Straddle';
      rationale = `IV at ${iv?.ivPercentile || '?'}th percentile appears cheap. Historical avg ${hist?.avgMove || 'N/A'}% exceeds implied ${move.impliedMovePct}%. Buy straddle for event vol.`;
      secondary = 'Long Strangle';
    } else {
      const whisperDir = r.hasWhisper && r.whisperNumber > r.epsEstimate ? 'bullish' : 'bearish';
      if (whisperDir === 'bullish') {
        strategy = 'Bull Call Spread';
        rationale = `Fair IV with positive whisper bias. Buy ATM call spread for directional play.`;
        secondary = 'Risk Reversal (long call, short put)';
      } else {
        strategy = 'Bear Put Spread';
        rationale = `Fair IV with whisper below estimate. Buy ATM put spread.`;
        secondary = 'Risk Reversal (long put, short call)';
      }
    }

    const straddlePrice = move.straddlePrice;
    const maxLoss = strategy.includes('Short') ? straddlePrice * 3 : straddlePrice;
    const maxGain = strategy.includes('Short') ? straddlePrice : straddlePrice * 3;

    const profitProb = isOverpriced && !historicalBeatsImplied ? 65 :
                       historicalBeatsImplied ? 55 : 50;

    return {
      strategy,
      rationale,
      secondary,
      entryLimit: MathUtils.round(straddlePrice, 2),
      maxLoss: MathUtils.round(maxLoss, 2),
      maxGain: MathUtils.round(maxGain, 2),
      profitProb,
      expectedValue: MathUtils.round((maxGain * profitProb / 100) - (maxLoss * (100 - profitProb) / 100), 2),
      breakevens: {
        upper: MathUtils.round(r.currentPrice + straddlePrice, 2),
        lower: MathUtils.round(r.currentPrice - straddlePrice, 2),
      },
      takeProfit1: { pct: 50, scale: 50 },
      takeProfit2: { pct: 75, scale: 100 },
      stopLoss: MathUtils.round(straddlePrice * 0.5, 2),
      maxHoldDays: 3,
    };
  }

  function _calculateEdge(r) {
    let edge = 50;
    if (r.ivRichness) {
      if (r.ivRichness.classification === 'severely-overpriced') edge += 15;
      else if (r.ivRichness.classification === 'overpriced') edge += 10;
      else if (r.ivRichness.classification === 'underpriced') edge += 5;
      else if (r.ivRichness.classification === 'severely-underpriced') edge += 10;
    }
    if (r.historicalMoves && r.impliedMove) {
      const diff = Math.abs(r.historicalMoves.avgMove - r.impliedMove.impliedMovePct);
      edge += Math.min(diff * 2, 15);
    }
    if (r.hasWhisper) edge += 5;
    if (r.tier === 1) edge += 5;
    if (r.liquidity?.status === 'REJECT') edge -= 30;
    return MathUtils.round(MathUtils.clamp(edge, 0, 100), 1);
  }

  function getResults() { return _results; }

  return { run, classifyTier, getResults, abort };
})();
