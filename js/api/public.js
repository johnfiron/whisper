/**
 * Public.com API client — wraps REST endpoints with rate limiting and error handling.
 * Provides the same public interface as the former TradierAPI module.
 * Historical price data is served via a local Yahoo Finance proxy.
 */
const PublicAPI = (() => {
  const RATE_LIMIT_DELAY = [1000, 2000, 4000];
  let _requestCount = 0;

  /**
   * Order limits for future use (read-only reference).
   */
  const ORDER_LIMITS = Object.freeze({
    equity: {
      regularHoursWholeMin: 1,
      regularHoursWholeMax: 10000,
      regularHoursWholeMaxNotional: 5000000,
      regularHoursFracMinNotional: 5,
      regularHoursFracMaxNotional: 250000,
      extendedHoursMax: 10000,
      otcMax: 10000,
      otcMaxNotional: 1000000,
      priceDecimalsAbove1: 2,
      priceDecimalsBelow1: 4,
    },
    options: {
      minContracts: 1,
      equityMaxContracts: 1999,
      indexMarketStopMax: 999,
      indexLimitStopLimitMax: 1999,
      specialSymbolsMax: 1499,
      specialSymbols: ['SPY', 'QQQ'],
      maxLegs: 6,
      marketOrderMaxNotional: 50000,
      stopLimitOrderMaxNotional: 500000,
      priceIncrementBelow3: 0.01,
      priceIncrementAbove3: 0.05,
    },
  });

  async function _post(path, body = {}, retries = 0) {
    const base = Config.publicBaseUrl();
    const headers = Config.publicHeaders();
    const accountId = Config.get('publicAccountId');

    if (!headers.Authorization || headers.Authorization === 'Bearer ') {
      throw new Error('Public.com access token not configured. Open Settings to add your token.');
    }
    if (!accountId) {
      throw new Error('Public.com Account ID not configured. Open Settings to add your account ID.');
    }

    const url = `${base}${path.replace('{accountId}', accountId)}`;
    _requestCount++;
    Logger.dim(`API [${_requestCount}]: POST ${path} ${JSON.stringify(body)}`);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (resp.status === 401) {
        throw new Error('Public.com access token expired or invalid. Regenerate your token in Settings.');
      }
      if (resp.status === 429) {
        if (retries < 3) {
          const delay = RATE_LIMIT_DELAY[retries];
          Logger.warn(`Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/3)`);
          await new Promise(r => setTimeout(r, delay));
          return _post(path, body, retries + 1);
        }
        throw new Error('Rate limit exceeded after 3 retries');
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Public.com ${resp.status}: ${text}`);
      }
      return resp.json();
    } catch (err) {
      if (err.message.includes('Failed to fetch') && retries < 3) {
        const delay = RATE_LIMIT_DELAY[retries];
        Logger.warn(`Network error, retrying in ${delay}ms (attempt ${retries + 1}/3)`);
        await new Promise(r => setTimeout(r, delay));
        return _post(path, body, retries + 1);
      }
      throw err;
    }
  }

  function _normalizeQuote(quote) {
    return {
      symbol: quote.instrument?.symbol || '',
      last: parseFloat(quote.last) || 0,
      prevclose: parseFloat(quote.previousClose) || 0,
      bid: parseFloat(quote.bid) || 0,
      ask: parseFloat(quote.ask) || 0,
      volume: quote.volume || 0,
      change_percentage: parseFloat(quote.oneDayChange?.percentChange) || 0,
    };
  }

  function _normalizeOption(raw, type) {
    const details = raw.optionDetails || {};
    const greeks = details.greeks || {};
    const iv = parseFloat(greeks.impliedVolatility) || 0;
    return {
      symbol: raw.instrument?.symbol || '',
      option_type: type,
      strike: parseFloat(details.strikePrice) || 0,
      bid: parseFloat(raw.bid) || 0,
      ask: parseFloat(raw.ask) || 0,
      last: parseFloat(raw.last) || 0,
      volume: raw.volume || 0,
      open_interest: raw.openInterest || 0,
      greeks: {
        delta: parseFloat(greeks.delta) || 0,
        gamma: parseFloat(greeks.gamma) || 0,
        theta: parseFloat(greeks.theta) || 0,
        vega: parseFloat(greeks.vega) || 0,
        rho: parseFloat(greeks.rho) || 0,
        mid_iv: iv,
        ask_iv: iv,
        bid_iv: iv,
        smv_vol: 0,
        phi: 0,
      },
    };
  }

  async function getQuote(symbol) {
    const data = await _post('/userapigateway/marketdata/{accountId}/quotes', {
      instruments: [{ symbol, type: 'EQUITY' }],
    });
    const quotes = data?.quotes;
    if (!quotes || !quotes.length) return null;
    return _normalizeQuote(quotes[0]);
  }

  async function getQuotes(symbols) {
    if (!symbols.length) return [];
    const results = [];
    for (let i = 0; i < symbols.length; i += 20) {
      const batch = symbols.slice(i, i + 20);
      const instruments = batch.map(s => ({ symbol: s, type: 'EQUITY' }));
      const data = await _post('/userapigateway/marketdata/{accountId}/quotes', { instruments });
      const quotes = data?.quotes || [];
      for (const q of quotes) {
        if (q.outcome === 'SUCCESS') results.push(_normalizeQuote(q));
      }
    }
    return results;
  }

  async function getOptionsExpirations(symbol) {
    const data = await _post('/userapigateway/marketdata/{accountId}/option-expirations', {
      instrument: { symbol, type: 'EQUITY' },
    });
    return data?.expirations || [];
  }

  async function getOptionsChain(symbol, expiration) {
    const data = await _post('/userapigateway/marketdata/{accountId}/option-chain', {
      instrument: { symbol, type: 'EQUITY' },
      expirationDate: expiration,
    });
    const calls = (data?.calls || []).map(c => _normalizeOption(c, 'call'));
    const puts = (data?.puts || []).map(p => _normalizeOption(p, 'put'));
    return [...calls, ...puts];
  }

  async function getHistory(symbol, start, end, interval = '1d') {
    const proxyUrl = Config.get('yahooProxyUrl') || 'http://localhost:8901';
    try {
      const params = new URLSearchParams({ start, end, interval });
      const resp = await fetch(
        `${proxyUrl}/api/history/${encodeURIComponent(symbol)}?${params}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!resp.ok) throw new Error(`Yahoo proxy ${resp.status}`);
      const data = await resp.json();
      return data.history || [];
    } catch (err) {
      Logger.warn(`History fetch failed for ${symbol}: ${err.message}`);
      return [];
    }
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
    getHistory, isOptionable, requestCount, resetCount, ORDER_LIMITS,
  };
})();
