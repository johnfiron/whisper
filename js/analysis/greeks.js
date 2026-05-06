/**
 * FUNCTION 8: Greeks Analysis with ORATS Precision
 * Extracts and computes derived metrics from Tradier's ORATS-backed Greeks.
 */
const GreeksAnalysis = (() => {

  /**
   * @param {object} option - Tradier option object with greeks
   * @param {number} underlyingPrice
   * @param {number} expectedMovePct - expected move in %
   * @returns {object}
   */
  function analyze(option, underlyingPrice, expectedMovePct) {
    const g = option.greeks || {};
    const price = _midPrice(option);

    const delta = g.delta || 0;
    const gamma = g.gamma || 0;
    const theta = g.theta || 0;
    const vega = g.vega || 0;
    const rho = g.rho || 0;
    const phi = g.phi || 0;
    const bidIV = g.bid_iv || 0;
    const midIV = g.mid_iv || 0;
    const askIV = g.ask_iv || 0;
    const smvVol = g.smv_vol || 0;

    const gammaScalpingPotential = gamma * (underlyingPrice ** 2) * ((expectedMovePct / 100) ** 2) * 0.5;
    const thetaDecayRate = price > 0 ? theta / price : 0;
    const vegaDollar = vega * 0.01;

    return {
      strike: option.strike,
      optionType: option.option_type,
      symbol: option.symbol,
      price: MathUtils.round(price, 2),
      delta: MathUtils.round(delta, 4),
      gamma: MathUtils.round(gamma, 4),
      theta: MathUtils.round(theta, 4),
      vega: MathUtils.round(vega, 4),
      rho: MathUtils.round(rho, 4),
      phi: MathUtils.round(phi, 4),
      bidIV: MathUtils.round(bidIV, 4),
      midIV: MathUtils.round(midIV, 4),
      askIV: MathUtils.round(askIV, 4),
      smvVol: MathUtils.round(smvVol, 4),
      gammaScalpingPotential: MathUtils.round(gammaScalpingPotential, 2),
      thetaDecayRate: MathUtils.round(thetaDecayRate, 4),
      thetaPctOfPremium: MathUtils.round(Math.abs(thetaDecayRate) * 100, 2),
      vegaDollar: MathUtils.round(vegaDollar, 2),
    };
  }

  function _midPrice(option) {
    const bid = option.bid || 0;
    const ask = option.ask || 0;
    if (bid && ask) return (bid + ask) / 2;
    return option.last || bid || ask || 0;
  }

  return { analyze };
})();
