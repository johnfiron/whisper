/**
 * FUNCTION 4: Expected IV Crush Post-Earnings
 * SpiderRock methodology for crush magnitude estimation.
 */
const IVCrush = (() => {

  /**
   * @param {string} ticker
   * @param {number} currentIV - current ATM IV (decimal, e.g. 0.45)
   * @param {number} impliedMovePct - implied move from straddle (%)
   * @param {number} historicalAvgMove - avg historical earnings move (%)
   * @returns {object}
   */
  function calculate(ticker, currentIV, impliedMovePct, historicalAvgMove) {
    Logger.info(`IVCrush: forecasting for ${ticker}`);

    const histRatio = historicalAvgMove > 0
      ? Math.min(historicalAvgMove / impliedMovePct, 0.7)
      : 0.5;

    const crushMagnitude = currentIV * (1 - histRatio);
    const postEarningsIV = currentIV - crushMagnitude;
    const crushPct = (crushMagnitude / currentIV) * 100;

    const normDays = _estimateNormDays(crushPct);

    return {
      ticker,
      currentIV: MathUtils.round(currentIV, 4),
      currentIVPct: MathUtils.round(currentIV * 100, 2),
      postEarningsIV: MathUtils.round(Math.max(postEarningsIV, 0.05), 4),
      postEarningsIVPct: MathUtils.round(Math.max(postEarningsIV, 0.05) * 100, 2),
      crushMagnitude: MathUtils.round(crushMagnitude, 4),
      crushMagnitudePct: MathUtils.round(crushMagnitude * 100, 2),
      crushPctOfIV: MathUtils.round(crushPct, 1),
      normalizationDays: normDays,
    };
  }

  function _estimateNormDays(crushPct) {
    if (crushPct > 50) return 5;
    if (crushPct > 30) return 4;
    return 3;
  }

  return { calculate };
})();
