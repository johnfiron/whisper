/**
 * FUNCTION 3: Calculate IV Richness with Historical Accuracy
 * Uses IV data from Public.com API for IV percentile and rank.
 */
const IVRichness = (() => {

  /**
   * @param {string} ticker
   * @param {number} currentIV - ATM IV from options chain
   * @param {Array} historicalPrices - daily price history for percentile calc
   * @returns {object} IV richness analysis
   */
  function calculate(ticker, currentIV, historicalPrices = []) {
    Logger.info(`IVRichness: analyzing ${ticker} IV=${MathUtils.round(currentIV * 100, 1)}%`);

    let ivPercentile = 50;
    let ivRank = 50;
    let ivHigh = currentIV;
    let ivLow = currentIV;

    if (historicalPrices.length >= 20) {
      const hvSeries = _calcHistoricalVols(historicalPrices);
      if (hvSeries.length > 10) {
        ivPercentile = MathUtils.round(MathUtils.percentileRank(hvSeries, currentIV), 1);
        ivHigh = Math.max(...hvSeries);
        ivLow = Math.min(...hvSeries);
        ivRank = MathUtils.round(MathUtils.ivRank(currentIV, ivLow, ivHigh), 1);
      }
    }

    const classification = _classify(ivPercentile);

    return {
      ticker,
      currentIV: MathUtils.round(currentIV, 4),
      currentIVPct: MathUtils.round(currentIV * 100, 2),
      ivPercentile,
      ivRank,
      ivHigh: MathUtils.round(ivHigh, 4),
      ivLow: MathUtils.round(ivLow, 4),
      classification,
      classificationLabel: _classLabel(classification),
    };
  }

  function _calcHistoricalVols(prices) {
    if (prices.length < 22) return [];
    const vols = [];
    for (let i = 20; i < prices.length; i++) {
      const window = prices.slice(i - 20, i);
      const returns = [];
      for (let j = 1; j < window.length; j++) {
        if (window[j - 1].close && window[j].close) {
          returns.push(Math.log(window[j].close / window[j - 1].close));
        }
      }
      if (returns.length >= 10) {
        const sd = MathUtils.stddev(returns);
        vols.push(sd * Math.sqrt(252));
      }
    }
    return vols;
  }

  function _classify(pctile) {
    const t = Config.get('ivClassification') || Config.DEFAULTS.ivClassification;
    if (pctile >= t.severelyOverpriced) return 'severely-overpriced';
    if (pctile >= t.overpriced) return 'overpriced';
    if (pctile >= t.underpriced) return 'fair';
    if (pctile >= 10) return 'underpriced';
    return 'severely-underpriced';
  }

  function _classLabel(cls) {
    const map = {
      'severely-overpriced': 'Severely Overpriced',
      'overpriced': 'Overpriced',
      'fair': 'Fair',
      'underpriced': 'Underpriced',
      'severely-underpriced': 'Severely Underpriced',
    };
    return map[cls] || 'Unknown';
  }

  return { calculate };
})();
