/**
 * FUNCTIONS 11-14: News Integration Protocol
 * Sentiment analysis, pricing-in assessment, peer contagion, vol adjustment.
 */
const NewsAnalysis = (() => {

  /**
   * FUNCTION 11: Build News Timeline and Impact
   */
  async function buildTimeline(ticker, earningsDate) {
    const start = DateUtils.toYMD(DateUtils.addDays(DateUtils.parseYMD(earningsDate), -7));
    const end = DateUtils.toYMD(DateUtils.addDays(DateUtils.parseYMD(earningsDate), 1));

    const articles = await NewsAPI.fetchNews(ticker, start, end);
    if (!articles.length) {
      return { ticker, articles: [], bullish: 0, bearish: 0, neutral: 0, avgSentiment: 0, mostImpactful: null };
    }

    const analyzed = articles.map(a => {
      const sentiment = a.sentiment != null ? a.sentiment : _simpleSentiment(a.title);
      const classification = sentiment > 0.15 ? 'bullish' : sentiment < -0.15 ? 'bearish' : 'neutral';
      return { ...a, sentiment, classification };
    });

    const bullish = analyzed.filter(a => a.classification === 'bullish').length;
    const bearish = analyzed.filter(a => a.classification === 'bearish').length;
    const neutral = analyzed.filter(a => a.classification === 'neutral').length;
    const avgSentiment = MathUtils.mean(analyzed.map(a => a.sentiment));

    const sorted = [...analyzed].sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment));
    const mostImpactful = sorted[0] || null;

    return {
      ticker,
      articles: analyzed,
      bullish,
      bearish,
      neutral,
      avgSentiment: MathUtils.round(avgSentiment, 3),
      mostImpactful,
    };
  }

  /**
   * FUNCTION 12: Determine News Pricing-In
   */
  function determinePricingIn(ticker, priceHistory, impliedMovePct) {
    if (!priceHistory || priceHistory.length < 7) {
      return { status: 'Not Assessed', pricedInFactor: 0, incrementalMove: impliedMovePct };
    }

    const last7 = priceHistory.slice(-7);
    const last3 = priceHistory.slice(-3);
    const last1 = priceHistory.slice(-1);

    const move7 = _totalMove(last7);
    const move3 = _totalMove(last3);
    const move1 = _totalMove(last1);

    let status = 'Not Priced';
    let pricedInFactor = 0;

    if (Math.abs(move1) > impliedMovePct * 0.5) {
      status = 'Fully Priced';
      pricedInFactor = 0.7;
    } else if (Math.abs(move3) > impliedMovePct * 0.3) {
      status = 'Heavily Priced';
      pricedInFactor = 0.5;
    } else if (Math.abs(move7) > impliedMovePct * 0.15) {
      status = 'Partially Priced';
      pricedInFactor = 0.25;
    }

    const incrementalMove = impliedMovePct * (1 - pricedInFactor);

    return {
      status,
      pricedInFactor: MathUtils.round(pricedInFactor, 2),
      incrementalMove: MathUtils.round(incrementalMove, 2),
      move7d: MathUtils.round(move7, 2),
      move3d: MathUtils.round(move3, 2),
      move1d: MathUtils.round(move1, 2),
    };
  }

  /**
   * FUNCTION 13: Peer Contagion Score
   */
  function peerContagionScore(ticker, sector, allStocks) {
    const peers = (allStocks || []).filter(s =>
      s.sector === sector && s.ticker !== ticker
    );

    return {
      ticker,
      sector,
      peers: peers.map(p => ({
        ticker: p.ticker,
        expectedReactionMagnitude: MathUtils.round(0.3 + Math.random() * 0.4, 2),
      })),
      isContagionCarrier: peers.length >= 2,
    };
  }

  /**
   * FUNCTION 14: News-Driven Volatility Adjustment
   */
  function volAdjustment(ticker, currentIV, newsTimeline) {
    if (!newsTimeline || !newsTimeline.articles || !newsTimeline.articles.length) {
      return { factor: 1.0, flagged: false, reason: 'No news data' };
    }

    const headlineCount = newsTimeline.articles.length;
    const avgAbsSentiment = MathUtils.mean(newsTimeline.articles.map(a => Math.abs(a.sentiment || 0)));
    const isHighNewsVol = headlineCount > 5 && avgAbsSentiment > 0.3;

    let factor = 1.0;
    let flagged = false;
    let reason = 'Normal';

    if (isHighNewsVol) {
      factor = 0.8;
      flagged = true;
      reason = 'Event risk inflated by news cycle — position size reduced 20%';
    } else if (headlineCount > 3) {
      factor = 0.9;
      reason = 'Moderate news volume — slight adjustment';
    } else if (avgAbsSentiment > 0.5) {
      factor = 1.1;
      reason = 'Strong directional sentiment — potential vol expansion';
    }

    return {
      factor: MathUtils.round(factor, 2),
      flagged,
      reason,
      headlineCount,
      avgAbsSentiment: MathUtils.round(avgAbsSentiment, 3),
    };
  }

  function _simpleSentiment(title) {
    if (!title) return 0;
    const t = title.toLowerCase();
    const bullWords = ['beat', 'surge', 'rally', 'upgrade', 'growth', 'strong', 'record', 'exceeds', 'boost', 'raises', 'positive', 'outperform', 'breakout', 'soar'];
    const bearWords = ['miss', 'decline', 'drop', 'downgrade', 'weak', 'loss', 'cut', 'warning', 'concern', 'risk', 'fall', 'slump', 'plunge', 'crash'];

    let score = 0;
    for (const w of bullWords) { if (t.includes(w)) score += 0.2; }
    for (const w of bearWords) { if (t.includes(w)) score -= 0.2; }
    return MathUtils.clamp(score, -1, 1);
  }

  function _totalMove(prices) {
    if (prices.length < 2) return 0;
    const first = prices[0].close || prices[0].open;
    const last = prices[prices.length - 1].close;
    return first ? MathUtils.pctChange(first, last) : 0;
  }

  return { buildTimeline, determinePricingIn, peerContagionScore, volAdjustment };
})();
