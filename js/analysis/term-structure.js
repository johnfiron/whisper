/**
 * FUNCTION 7: Volatility Term Structure Analysis
 * Forward variance subtraction to isolate event volatility.
 */
const TermStructure = (() => {

  /**
   * @param {string} ticker
   * @param {string} earningsDate
   * @returns {object}
   */
  async function analyze(ticker, earningsDate) {
    Logger.info(`TermStructure: analyzing ${ticker}`);

    const expirations = await TradierAPI.getOptionsExpirations(ticker);
    if (expirations.length < 2) {
      Logger.warn(`TermStructure: need >=2 expirations for ${ticker}, got ${expirations.length}`);
      return _emptyResult(ticker);
    }

    const eDate = DateUtils.parseYMD(earningsDate);
    const sorted = expirations
      .map(e => ({ str: e, date: DateUtils.parseYMD(e) }))
      .filter(e => e.date >= eDate)
      .sort((a, b) => a.date - b.date);

    if (sorted.length < 2) return _emptyResult(ticker);

    const t1Expiry = sorted[0].str;
    const t2Expiry = sorted[1].str;

    const [chain1, chain2] = await Promise.all([
      TradierAPI.getOptionsChain(ticker, t1Expiry),
      TradierAPI.getOptionsChain(ticker, t2Expiry),
    ]);

    const quote = await TradierAPI.getQuote(ticker);
    const price = quote?.last || quote?.prevclose || 0;
    if (!price) return _emptyResult(ticker);

    const iv1 = _getATMIV(chain1, price);
    const iv2 = _getATMIV(chain2, price);

    if (!iv1 || !iv2) return _emptyResult(ticker);

    const now = new Date();
    const T1 = Math.max(DateUtils.tradingDaysBetween(now, DateUtils.parseYMD(t1Expiry)), 1) / 365;
    const T2 = Math.max(DateUtils.tradingDaysBetween(now, DateUtils.parseYMD(t2Expiry)), 1) / 365;

    const var1 = iv1 * iv1 * T1;
    const var2 = iv2 * iv2 * T2;
    const dT = T2 - T1;

    let eventVol = 0;
    if (dT > 0) {
      const forwardVar = (var2 - var1) / dT;
      eventVol = forwardVar > 0 ? Math.sqrt(forwardVar) : 0;
    }

    const slope = iv1 - iv2;
    const slopePct = MathUtils.round(slope * 100, 2);
    const structure = slope > 0.01 ? 'Inverted (Backwardation)' : slope < -0.01 ? 'Contango' : 'Flat';

    return {
      ticker,
      frontExpiry: t1Expiry,
      backExpiry: t2Expiry,
      frontIV: MathUtils.round(iv1, 4),
      backIV: MathUtils.round(iv2, 4),
      frontIVPct: MathUtils.round(iv1 * 100, 2),
      backIVPct: MathUtils.round(iv2 * 100, 2),
      eventVol: MathUtils.round(eventVol, 4),
      eventVolPct: MathUtils.round(eventVol * 100, 2),
      slopePct,
      structure,
    };
  }

  function _getATMIV(chain, price) {
    const calls = chain.filter(o => o.option_type === 'call' && o.greeks);
    if (!calls.length) return null;
    calls.sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price));
    const atm = calls[0];
    return atm.greeks?.mid_iv || atm.greeks?.ask_iv || null;
  }

  function _emptyResult(ticker) {
    return {
      ticker,
      frontExpiry: '', backExpiry: '',
      frontIV: 0, backIV: 0, frontIVPct: 0, backIVPct: 0,
      eventVol: 0, eventVolPct: 0, slopePct: 0,
      structure: 'N/A',
    };
  }

  return { analyze };
})();
