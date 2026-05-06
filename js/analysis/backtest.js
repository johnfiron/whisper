/**
 * FUNCTION 5: Straddle Portfolio Backtest
 * SpiderRock-style earnings straddle portfolio analysis.
 */
const StraddleBacktest = (() => {

  /**
   * @param {string} ticker
   * @param {number} impliedMovePct
   * @param {object} historicalMoves - from HistoricalMoves.analyze()
   * @returns {object}
   */
  function analyze(ticker, impliedMovePct, historicalMoves) {
    Logger.info(`StraddleBacktest: ${ticker}`);

    if (!historicalMoves || !historicalMoves.moves.length) {
      return _emptyResult(ticker);
    }

    const moves = historicalMoves.absMoves;
    const excessReturns = moves.map(m => {
      const premiumPct = impliedMovePct;
      return ((premiumPct - m) / premiumPct) * 100;
    });

    const wins = excessReturns.filter(r => r > 0).length;
    const winRate = (wins / excessReturns.length) * 100;
    const avgExcess = MathUtils.mean(excessReturns);
    const sr = MathUtils.sharpeRatio(excessReturns);
    const ci = MathUtils.confidenceInterval(excessReturns, 0.95);

    return {
      ticker,
      quarterCount: moves.length,
      avgExcessReturn: MathUtils.round(avgExcess, 2),
      winRate: MathUtils.round(winRate, 1),
      sharpeRatio: MathUtils.round(sr, 2),
      confidenceLower: MathUtils.round(ci.lower, 2),
      confidenceUpper: MathUtils.round(ci.upper, 2),
      excessReturns: excessReturns.map(r => MathUtils.round(r, 2)),
      recommendation: avgExcess > 10 && winRate > 60 ? 'Short Straddle Favored' :
                       avgExcess < -10 ? 'Long Straddle Favored' : 'Neutral',
    };
  }

  function _emptyResult(ticker) {
    return {
      ticker, quarterCount: 0,
      avgExcessReturn: 0, winRate: 0, sharpeRatio: 0,
      confidenceLower: 0, confidenceUpper: 0,
      excessReturns: [], recommendation: 'Insufficient Data',
    };
  }

  return { analyze };
})();
