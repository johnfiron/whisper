/**
 * Financial math utilities.
 */
const MathUtils = (() => {
  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  }

  function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  function percentileRank(arr, value) {
    const below = arr.filter(v => v < value).length;
    return (below / arr.length) * 100;
  }

  function ivRank(current, low, high) {
    if (high === low) return 50;
    return ((current - low) / (high - low)) * 100;
  }

  function impliedMoveFromStraddle(straddlePrice, underlyingPrice) {
    return (straddlePrice / underlyingPrice) * 100;
  }

  function stddevMove(iv, daysToExpiry) {
    return iv * Math.sqrt(daysToExpiry / 365) * 100;
  }

  function oneDayStddev(iv, price) {
    return price * (iv / 100) * Math.sqrt(1 / 252);
  }

  function correlation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return 0;
    const mx = mean(x.slice(0, n));
    const my = mean(y.slice(0, n));
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx;
      const b = y[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
  }

  function sharpeRatio(returns, riskFree = 0) {
    const m = mean(returns) - riskFree;
    const s = stddev(returns);
    return s === 0 ? 0 : m / s;
  }

  function confidenceInterval(arr, confidence = 0.95) {
    const m = mean(arr);
    const s = stddev(arr);
    const z = confidence === 0.95 ? 1.96 : 1.645;
    const margin = z * (s / Math.sqrt(arr.length));
    return { lower: m - margin, upper: m + margin, mean: m };
  }

  function weightedAverage(values, weights) {
    let num = 0, den = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i] != null && weights[i] != null) {
        num += values[i] * weights[i];
        den += weights[i];
      }
    }
    return den === 0 ? 0 : num / den;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function round(v, decimals = 2) {
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
  }

  function pctChange(oldVal, newVal) {
    if (oldVal === 0) return 0;
    return ((newVal - oldVal) / Math.abs(oldVal)) * 100;
  }

  return {
    mean, stddev, percentile, percentileRank, ivRank,
    impliedMoveFromStraddle, stddevMove, oneDayStddev,
    correlation, sharpeRatio, confidenceInterval,
    weightedAverage, clamp, round, pctChange,
  };
})();
