/**
 * Configuration manager — persists to localStorage, provides defaults.
 */
const Config = (() => {
  const STORAGE_KEY = 'earningsedge_config';

  const DEFAULTS = {
    tradierToken: '',
    tradierEnv: 'sandbox',
    newsProvider: 'none',
    newsToken: '',
    autoRefreshSec: 300,
    excludeIlliquid: true,
    useWhisper: true,
    tierThresholds: {
      mega: 200e9,
      large: 10e9,
      mid: 2e9,
    },
    ivClassification: {
      severelyOverpriced: 90,
      overpriced: 70,
      fair: 30,
      underpriced: 10,
    },
    liquidityLimits: {
      spreadReject: 50,
      spreadWarn: 20,
      minOI: 100,
      minVolume: 50,
    },
    modelWeights: {
      straddle: 0.35,
      stddev: 0.20,
      historical: 0.15,
      whisper: 0.15,
      news: 0.15,
    },
  };

  let _config = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      _config = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      _config = { ...DEFAULTS };
    }
    return _config;
  }

  function save(partial) {
    _config = { ..._config, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
  }

  function get(key) {
    if (!_config) load();
    return key ? _config[key] : _config;
  }

  function tradierBaseUrl() {
    if (!_config) load();
    return _config.tradierEnv === 'production'
      ? 'https://api.tradier.com/v1'
      : 'https://sandbox.tradier.com/v1';
  }

  function tradierHeaders() {
    if (!_config) load();
    return {
      Authorization: `Bearer ${_config.tradierToken}`,
      Accept: 'application/json',
    };
  }

  return { load, save, get, tradierBaseUrl, tradierHeaders, DEFAULTS };
})();
