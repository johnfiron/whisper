/**
 * FUNCTION 6: Historical Earnings Move Analysis
 * Analyzes last 8 quarters of earnings reactions from price history.
 */
const HistoricalMoves = (() => {

  /**
   * For a given ticker, calculate historical earnings-day moves.
   * Uses quarterly price data around known earnings dates.
   * @param {string} ticker
   * @param {string} earningsDate - YYYY-MM-DD of upcoming earnings
   * @returns {object}
   */
  async function analyze(ticker, earningsDate) {
    Logger.info(`HistoricalMoves: analyzing ${ticker} past 8 quarters`);

    const endDate = earningsDate;
    const startDate = DateUtils.toYMD(DateUtils.addDays(DateUtils.parseYMD(earningsDate), -730));

    let prices;
    try {
      prices = await PublicAPI.getHistory(ticker, startDate, endDate);
    } catch (err) {
      Logger.warn(`HistoricalMoves: could not fetch history for ${ticker}: ${err.message}`);
      return _emptyResult(ticker);
    }

    if (!prices || prices.length < 60) {
      Logger.warn(`HistoricalMoves: insufficient price data for ${ticker} (${prices?.length || 0} days)`);
      return _emptyResult(ticker);
    }

    const quarterlyDates = _estimateQuarterlyEarnings(earningsDate, 8);
    const moves = [];

    for (const qDate of quarterlyDates) {
      const move = _findMoveAroundDate(prices, qDate);
      if (move !== null) moves.push(move);
    }

    if (moves.length === 0) {
      const gapMoves = _findLargeGaps(prices);
      moves.push(...gapMoves.slice(0, 8));
    }

    if (!moves.length) return _emptyResult(ticker);

    const absMoves = moves.map(Math.abs);
    return {
      ticker,
      moves,
      absMoves,
      avgMove: MathUtils.round(MathUtils.mean(absMoves), 2),
      maxMove: MathUtils.round(Math.max(...absMoves), 2),
      minMove: MathUtils.round(Math.min(...absMoves), 2),
      stddev: MathUtils.round(MathUtils.stddev(absMoves), 2),
      count: moves.length,
      directionalMoves: moves.map(m => MathUtils.round(m, 2)),
    };
  }

  function _estimateQuarterlyEarnings(upcomingDate, count) {
    const dates = [];
    let d = DateUtils.parseYMD(upcomingDate);
    for (let i = 0; i < count; i++) {
      d = DateUtils.addDays(d, -91);
      while (DateUtils.isWeekend(d)) d = DateUtils.addDays(d, -1);
      dates.push(DateUtils.toYMD(d));
    }
    return dates;
  }

  function _findMoveAroundDate(prices, targetDate) {
    const target = DateUtils.parseYMD(targetDate);
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < prices.length; i++) {
      const d = DateUtils.parseYMD(prices[i].date);
      const dist = Math.abs(d - target);
      if (dist < bestDist && dist < 7 * 86400000) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx < 1 || bestIdx >= prices.length) return null;
    const before = prices[bestIdx - 1].close;
    const after = prices[bestIdx].open || prices[bestIdx].close;
    if (!before || !after) return null;
    return MathUtils.pctChange(before, after);
  }

  function _findLargeGaps(prices) {
    const gaps = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1].close;
      const curr = prices[i].open || prices[i].close;
      if (prev && curr) {
        const pct = Math.abs(MathUtils.pctChange(prev, curr));
        if (pct > 2) gaps.push({ pct: MathUtils.pctChange(prev, curr), idx: i });
      }
    }
    gaps.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    return gaps.slice(0, 8).map(g => g.pct);
  }

  function _emptyResult(ticker) {
    return {
      ticker, moves: [], absMoves: [],
      avgMove: 0, maxMove: 0, minMove: 0, stddev: 0, count: 0,
      directionalMoves: [],
    };
  }

  return { analyze };
})();
