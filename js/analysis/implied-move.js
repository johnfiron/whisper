/**
 * FUNCTION 2: Calculate Implied Earnings Move with Precision
 * Uses ATM straddle method (85% of ATM straddle) plus 1-std dev comparison.
 */
const ImpliedMove = (() => {

  /**
   * @param {string} ticker
   * @param {number} currentPrice
   * @param {string} earningsDate - YYYY-MM-DD
   * @returns {object} implied move calculation result
   */
  async function calculate(ticker, currentPrice, earningsDate) {
    Logger.info(`ImpliedMove: calculating for ${ticker} @ $${currentPrice}`);

    const expirations = await TradierAPI.getOptionsExpirations(ticker);
    if (!expirations.length) {
      throw new Error(`No options expirations found for ${ticker}`);
    }

    const frontExpiry = _findFrontExpiry(expirations, earningsDate);
    if (!frontExpiry) {
      throw new Error(`No suitable expiry after earnings for ${ticker}`);
    }

    Logger.dim(`ImpliedMove: ${ticker} using expiry ${frontExpiry}`);
    const chain = await TradierAPI.getOptionsChain(ticker, frontExpiry);
    if (!chain.length) {
      throw new Error(`Empty chain for ${ticker} expiry ${frontExpiry}`);
    }

    const atm = _findATM(chain, currentPrice);
    if (!atm.call || !atm.put) {
      throw new Error(`Could not find ATM options for ${ticker}`);
    }

    const callPrice = _midPrice(atm.call);
    const putPrice = _midPrice(atm.put);
    const straddlePrice = callPrice + putPrice;

    const impliedMovePct = MathUtils.round((straddlePrice / currentPrice) * 100, 2);
    const impliedMoveDollar = MathUtils.round(straddlePrice, 2);
    const upperPrice = MathUtils.round(currentPrice + straddlePrice, 2);
    const lowerPrice = MathUtils.round(currentPrice - straddlePrice, 2);

    const callIV = atm.call.greeks?.mid_iv || atm.call.greeks?.ask_iv || 0;
    const putIV = atm.put.greeks?.mid_iv || atm.put.greeks?.ask_iv || 0;
    const avgIV = (callIV + putIV) / 2;

    const daysToExpiry = DateUtils.tradingDaysBetween(
      DateUtils.parseYMD(earningsDate),
      DateUtils.parseYMD(frontExpiry)
    ) || 1;

    const stddevMovePct = MathUtils.round(avgIV * Math.sqrt(daysToExpiry / 365) * 100, 2);
    const stddevUpper = MathUtils.round(currentPrice * (1 + stddevMovePct / 100), 2);
    const stddevLower = MathUtils.round(currentPrice * (1 - stddevMovePct / 100), 2);

    return {
      ticker,
      currentPrice,
      expiry: frontExpiry,
      atmStrike: atm.strike,
      callPrice: MathUtils.round(callPrice, 2),
      putPrice: MathUtils.round(putPrice, 2),
      straddlePrice: MathUtils.round(straddlePrice, 2),
      impliedMovePct,
      impliedMoveDollar,
      upperPrice,
      lowerPrice,
      avgIV: MathUtils.round(avgIV, 4),
      daysToExpiry,
      stddevMovePct,
      stddevUpper,
      stddevLower,
      callGreeks: atm.call.greeks || {},
      putGreeks: atm.put.greeks || {},
    };
  }

  function _findFrontExpiry(expirations, earningsDate) {
    const eDate = DateUtils.parseYMD(earningsDate);
    const sorted = expirations
      .map(e => ({ str: e, date: DateUtils.parseYMD(e) }))
      .filter(e => e.date >= eDate)
      .sort((a, b) => a.date - b.date);

    return sorted.length ? sorted[0].str : null;
  }

  function _findATM(chain, price) {
    const calls = chain.filter(o => o.option_type === 'call');
    const puts = chain.filter(o => o.option_type === 'put');
    const strikes = [...new Set(calls.map(c => c.strike))].sort((a, b) => Math.abs(a - price) - Math.abs(b - price));

    if (!strikes.length) return { call: null, put: null, strike: null };
    const bestStrike = strikes[0];
    return {
      call: calls.find(c => c.strike === bestStrike) || null,
      put: puts.find(p => p.strike === bestStrike) || null,
      strike: bestStrike,
    };
  }

  function _midPrice(option) {
    const bid = option.bid || 0;
    const ask = option.ask || 0;
    if (bid && ask) return (bid + ask) / 2;
    return option.last || bid || ask || 0;
  }

  return { calculate };
})();
