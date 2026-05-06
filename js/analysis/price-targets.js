/**
 * FUNCTION 9: Price Targets — Multi-Model Weighted Ensemble
 * Combines straddle, stddev, historical, whisper, and news models.
 */
const PriceTargets = (() => {

  /**
   * @param {object} params
   * @returns {object} predicted open, high, low, close with confidence
   */
  function calculate(params) {
    const {
      ticker, currentPrice, impliedMovePct, impliedMoveDollar,
      avgIV, historicalAvgMove, earningsTime,
      epsEstimate, whisperNumber, hasWhisper,
      newsSentiment, useWhisper, useNews,
    } = params;

    Logger.info(`PriceTargets: computing for ${ticker} @ $${currentPrice}`);

    const models = {};
    const weights = { ...Config.get('modelWeights') };

    // Model 1: Straddle-based
    models.straddle = {
      high: currentPrice + impliedMoveDollar,
      low: currentPrice - impliedMoveDollar,
    };

    // Model 2: IV Standard Deviation (68% probability, 1-day)
    const oneDaySD = MathUtils.oneDayStddev(avgIV * 100, currentPrice);
    models.stddev = {
      high: currentPrice + oneDaySD,
      low: currentPrice - oneDaySD,
    };

    // Model 3: Historical Average
    if (historicalAvgMove > 0) {
      models.historical = {
        high: currentPrice * (1 + historicalAvgMove / 100),
        low: currentPrice * (1 - historicalAvgMove / 100),
      };
    } else {
      models.historical = { ...models.straddle };
      weights.historical = 0;
    }

    // Model 4: Whisper-Adjusted
    if (hasWhisper && useWhisper && whisperNumber != null && epsEstimate != null && epsEstimate !== 0) {
      const surprise = (whisperNumber - epsEstimate) / Math.abs(epsEstimate);
      const adjFactor = 1 + (surprise * 0.5);
      models.whisper = {
        high: currentPrice * (1 + (impliedMovePct / 100) * adjFactor),
        low: currentPrice * (1 - (impliedMovePct / 100) * adjFactor),
      };
    } else {
      models.whisper = { ...models.straddle };
      weights.whisper = 0;
    }

    // Model 5: News-Adjusted
    const sentScore = newsSentiment || 0;
    if (useNews && sentScore !== 0) {
      const newsAdj = 1 + (sentScore * 0.15);
      models.news = {
        high: currentPrice * (1 + (impliedMovePct / 100) * newsAdj),
        low: currentPrice * (1 - (impliedMovePct / 100) / newsAdj),
      };
    } else {
      models.news = { ...models.straddle };
      weights.news = 0;
    }

    // Normalize weights
    const totalW = Object.values(weights).reduce((s, w) => s + w, 0);
    const normW = {};
    for (const k of Object.keys(weights)) {
      normW[k] = totalW > 0 ? weights[k] / totalW : 0;
    }

    const predictedHigh = MathUtils.round(
      normW.straddle * models.straddle.high +
      normW.stddev * models.stddev.high +
      normW.historical * models.historical.high +
      normW.whisper * models.whisper.high +
      normW.news * models.news.high, 2);

    const predictedLow = MathUtils.round(
      normW.straddle * models.straddle.low +
      normW.stddev * models.stddev.low +
      normW.historical * models.historical.low +
      normW.whisper * models.whisper.low +
      normW.news * models.news.low, 2);

    const predictedClose = MathUtils.round((predictedHigh + predictedLow) / 2, 2);

    const openAdj = earningsTime === 'BMO' ? impliedMovePct * 0.7 / 100 : 0;
    const predictedOpen = earningsTime === 'BMO'
      ? MathUtils.round(currentPrice * (1 + (sentScore > 0 ? openAdj : -openAdj * 0.5)), 2)
      : MathUtils.round(currentPrice, 2);

    const confidence = MathUtils.round((predictedHigh - predictedLow) / 2, 2);

    return {
      ticker,
      predictedOpen,
      predictedHigh,
      predictedLow,
      predictedClose,
      confidence,
      models,
      normalizedWeights: normW,
    };
  }

  return { calculate };
})();
