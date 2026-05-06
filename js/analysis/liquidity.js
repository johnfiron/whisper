/**
 * FUNCTION 10: Liquidity Screen
 * Validates that options are tradeable with acceptable spreads.
 */
const LiquidityScreen = (() => {

  /**
   * @param {object} option - Tradier option with bid/ask/volume/open_interest
   * @returns {object}
   */
  function screen(option) {
    if (!option) {
      return { score: 0, isTradeable: false, status: 'REJECT', reason: 'No option data' };
    }

    const bid = option.bid || 0;
    const ask = option.ask || 0;
    const mid = (bid + ask) / 2;
    const oi = option.open_interest || 0;
    const vol = option.volume || 0;

    const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 100;
    const limits = Config.get('liquidityLimits') || Config.DEFAULTS.liquidityLimits;

    let status = 'PASS';
    let score = 100;
    const issues = [];

    if (spreadPct > limits.spreadReject) {
      status = 'REJECT';
      score -= 50;
      issues.push(`Spread ${MathUtils.round(spreadPct, 1)}% > ${limits.spreadReject}% limit`);
    } else if (spreadPct > limits.spreadWarn) {
      status = 'WARNING';
      score -= 20;
      issues.push(`Spread ${MathUtils.round(spreadPct, 1)}% > ${limits.spreadWarn}% warn`);
    }

    if (oi < limits.minOI) {
      score -= 25;
      issues.push(`OI ${oi} < ${limits.minOI} minimum`);
      if (status === 'PASS') status = 'WARNING';
    }

    if (vol < limits.minVolume) {
      score -= 15;
      issues.push(`Volume ${vol} < ${limits.minVolume} minimum`);
      if (status === 'PASS') status = 'WARNING';
    }

    if (bid === 0 && ask === 0) {
      status = 'REJECT';
      score = 0;
      issues.push('Zero bid and ask');
    }

    const recommendedMaxPosition = _calcMaxPosition(mid, oi, vol);

    return {
      bid: MathUtils.round(bid, 2),
      ask: MathUtils.round(ask, 2),
      mid: MathUtils.round(mid, 2),
      spreadPct: MathUtils.round(spreadPct, 1),
      openInterest: oi,
      volume: vol,
      score: Math.max(0, score),
      isTradeable: status !== 'REJECT',
      status,
      issues,
      recommendedMaxPosition: MathUtils.round(recommendedMaxPosition, 0),
    };
  }

  function _calcMaxPosition(mid, oi, vol) {
    const baseByOI = oi * mid * 100 * 0.02;
    const baseByVol = vol * mid * 100 * 0.05;
    return Math.min(baseByOI, baseByVol, 50000);
  }

  return { screen };
})();
