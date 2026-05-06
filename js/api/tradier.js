/**
 * Tradier API client — wraps REST endpoints with rate limiting and error handling.
 * Greeks provided courtesy of ORATS APIs.
 * Sandbox API provides DELAYED data only; Greeks updated HOURLY.
 */
const TradierAPI = (() => {
  const RATE_LIMIT_DELAY = [1000, 2000, 4000];
  let _requestCount = 0;

  async function _fetch(path, params = {}, retries = 0) {
    const base = Config.tradierBaseUrl();
    const headers = Config.tradierHeaders();
    if (!headers.Authorization || headers.Authorization === 'Bearer ') {
      throw new Error('Tradier API token not configured. Open Settings to add your token.');
    }

    const url = new URL(`${base}${path}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });

    _requestCount++;
    Logger.dim(`API [${_requestCount}]: GET ${path} ${JSON.stringify(params)}`);

    try {
      const resp = await fetch(url.toString(), { headers });
      if (resp.status === 429) {
        if (retries < 3) {
          const delay = RATE_LIMIT_DELAY[retries];
          Logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/3)`);
          await new Promise(r => setTimeout(r, delay));
          return _fetch(path, params, retries + 1);
        }
        throw new Error('Rate limit exceeded after 3 retries');
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Tradier ${resp.status}: ${text}`);
      }
      return resp.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') && retries < 3) {
        const delay = RATE_LIMIT_DELAY[retries];
        Logger.warn(`Network error, retrying in ${delay}ms (attempt ${retries + 1}/3)`);
        await new Promise(r => setTimeout(r, delay));
        return _fetch(path, params, retries + 1);
      }
      throw err;
    }
  }

  async function getQuote(symbol) {
    const data = await _fetch('/markets/quotes', { symbols: symbol, greeks: 'true' });
    const quotes = data?.quotes?.quote;
    if (!quotes) return null;
    return Array.isArray(quotes) ? quotes[0] : quotes;
  }

  async function getQuotes(symbols) {
    if (!symbols.length) return [];
    const batches = [];
    for (let i = 0; i < symbols.length; i += 20) {
      batches.push(symbols.slice(i, i + 20));
    }
    const results = [];
    for (const batch of batches) {
      const data = await _fetch('/markets/quotes', { symbols: batch.join(','), greeks: 'true' });
      const q = data?.quotes?.quote;
      if (q) results.push(...(Array.isArray(q) ? q : [q]));
    }
    return results;
  }

  async function getOptionsExpirations(symbol) {
    const data = await _fetch('/markets/options/expirations', { symbol, includeAllRoots: 'true' });
    const exps = data?.expirations?.date;
    if (!exps) return [];
    return Array.isArray(exps) ? exps : [exps];
  }

  async function getOptionsChain(symbol, expiration) {
    const data = await _fetch('/markets/options/chains', {
      symbol, expiration, greeks: 'true',
    });
    const opts = data?.options?.option;
    if (!opts) return [];
    return Array.isArray(opts) ? opts : [opts];
  }

  async function getHistory(symbol, start, end, interval = 'daily') {
    const data = await _fetch('/markets/history', { symbol, start, end, interval });
    const hist = data?.history?.day;
    if (!hist) return [];
    return Array.isArray(hist) ? hist : [hist];
  }

  async function isOptionable(symbol) {
    try {
      const exps = await getOptionsExpirations(symbol);
      return exps.length > 0;
    } catch {
      return false;
    }
  }

  function requestCount() { return _requestCount; }
  function resetCount() { _requestCount = 0; }

  return {
    getQuote, getQuotes, getOptionsExpirations, getOptionsChain,
    getHistory, isOptionable, requestCount, resetCount,
  };
})();
