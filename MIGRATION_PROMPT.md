# Migration Prompt: Tradier API → Public.com API + Yahoo Finance News

## Objective

Migrate the **EarningsEdge Pro** browser-based earnings analysis platform from **Tradier API** to **Public.com API** for all market data (quotes, options expirations, options chains) and from the current multi-provider news system (Benzinga / Alpha Vantage / Polygon) to **Yahoo Finance via the `yfinance` Python library** served through a lightweight local proxy. Historical price data, which Tradier currently provides via `/markets/history`, is not available through Public.com's API — use **Yahoo Finance (`yfinance`)** for historical OHLC data as well.

This codebase is a **static, client-side JavaScript application** (no bundler, no Node.js backend, plain `<script>` tags, deployed to GitHub Pages). All API calls are made from the browser via `fetch()`. The application performs **read-only market data analysis** — it does NOT place orders — but the prompt includes Public.com's order limits for reference in case order placement is added later.

---

## Part 1: Architecture Overview & File Inventory

### Current Architecture

```
index.html                  ← HTML shell, script load order, settings UI
css/                        ← Stylesheets (main, trade-cards, network, charts)
js/
  utils/
    config.js               ← Config manager (localStorage), Tradier URL/headers helpers
    dates.js                ← Trading calendar utilities
    math.js                 ← Financial math (stats, correlations, IV)
    logger.js               ← Pipeline logging
  api/
    tradier.js              ← ★ Tradier REST client (quotes, expirations, chains, history)
    earnings-calendar.js    ← WhisperNumber scraper + built-in fallback
    news.js                 ← ★ Multi-provider news (Benzinga / Alpha Vantage / Polygon)
  analysis/
    pipeline.js             ← Orchestrator: calls TradierAPI.* methods throughout
    implied-move.js         ← Uses TradierAPI.getOptionsExpirations + getOptionsChain
    iv-richness.js          ← Uses historical prices (from TradierAPI.getHistory)
    iv-crush.js             ← Pure math, no direct API calls
    historical-moves.js     ← Uses TradierAPI.getHistory
    term-structure.js       ← Uses TradierAPI.getOptionsExpirations + getOptionsChain + getQuote
    greeks.js               ← Consumes Tradier option objects with greeks
    price-targets.js        ← Uses news sentiment data
    liquidity.js            ← Consumes Tradier option bid/ask/OI/volume
    news-analysis.js        ← Consumes NewsAPI.fetchNews output
    backtest.js             ← Pure math
  ui/
    dashboard.js            ← Dashboard rendering
    trade-cards-ui.js       ← Trade card rendering (includes news timeline section)
    settings.js             ← Settings panel (saves/loads Tradier token, news provider)
    charts.js               ← Chart.js visualizations
  network/
    network-graph.js        ← Three.js 3D force-directed graph
  app.js                    ← Entry point, checks tradierToken, calls TradierAPI.resetCount()
```

### Files That Must Change

| File | What Changes |
|------|-------------|
| `js/api/tradier.js` | **Replace entirely** → `js/api/public.js` (Public.com REST client) |
| `js/api/news.js` | **Replace entirely** → Yahoo Finance news via local proxy |
| `js/utils/config.js` | Replace `tradierToken`/`tradierEnv`/`tradierBaseUrl()`/`tradierHeaders()` with Public.com equivalents (`publicAccessToken`, `publicAccountId`, `publicBaseUrl()`, `publicHeaders()`); replace `newsProvider`/`newsToken` with Yahoo Finance config |
| `js/ui/settings.js` | Update field IDs and save logic for new config keys |
| `index.html` | Update settings panel HTML (input IDs, labels, dropdowns) |
| `js/app.js` | Replace `tradierToken` check with `publicAccessToken` check; replace `TradierAPI.resetCount()` / `TradierAPI.requestCount()` with equivalent |
| `js/analysis/pipeline.js` | Replace all `TradierAPI.*` calls with `PublicAPI.*` calls |
| `js/analysis/implied-move.js` | Replace `TradierAPI.getOptionsExpirations` + `TradierAPI.getOptionsChain`; adapt field names for Public.com response shapes |
| `js/analysis/historical-moves.js` | Replace `TradierAPI.getHistory` with Yahoo Finance historical data via proxy |
| `js/analysis/term-structure.js` | Replace `TradierAPI.getOptionsExpirations` + `TradierAPI.getOptionsChain` + `TradierAPI.getQuote` |
| `js/analysis/iv-richness.js` | Update JSDoc comment (cosmetic); price history format remains `{date, close}` |
| `js/analysis/greeks.js` | Update JSDoc comment; adapt Greek field names from Public.com format |
| `js/analysis/liquidity.js` | Update JSDoc comment; adapt option field names |
| `README.md` | Update setup instructions, API references, rate limit docs |

### Files That Do NOT Change (pure math / UI with no API dependency)

`js/utils/dates.js`, `js/utils/math.js`, `js/utils/logger.js`, `js/analysis/iv-crush.js`, `js/analysis/price-targets.js`, `js/analysis/backtest.js`, `js/ui/dashboard.js`, `js/ui/charts.js`, `js/network/network-graph.js`, `css/*`

---

## Part 2: Public.com API — Complete Reference

### Authentication

Public.com uses a **two-step auth flow**:

1. **Generate a Secret Key** at https://public.com/settings/security/api
2. **Exchange for Access Token**:
   ```
   POST https://api.public.com/userapiauthservice/personal/access-tokens
   Content-Type: application/json

   { "secret": "YOUR_SECRET_KEY", "validityInMinutes": 60 }
   ```
   Response: `{ "accessToken": "..." }`
3. **Use Bearer Token** in all requests:
   ```
   Authorization: Bearer YOUR_ACCESS_TOKEN
   ```

**Account ID** (required for all market data endpoints):
```
GET https://api.public.com/userapigateway/trading/account
Authorization: Bearer YOUR_ACCESS_TOKEN
```
Response includes `accountId` (string, persistent identifier).

**Rate Limits**: 10 requests/second (as of February 2026).

### Base URL

```
https://api.public.com
```

There is no sandbox/production toggle — Public.com uses a single production environment.

### Endpoint 1: Get Quotes

```
POST /userapigateway/marketdata/{accountId}/quotes
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "instruments": [
    { "symbol": "AAPL", "type": "EQUITY" },
    { "symbol": "AAPL  260516C00200000", "type": "OPTION" }
  ]
}
```

**Response**:
```json
{
  "quotes": [
    {
      "instrument": { "symbol": "AAPL", "type": "EQUITY" },
      "outcome": "SUCCESS",
      "last": "189.84",
      "lastTimestamp": "2026-05-06T20:00:00Z",
      "bid": "189.82",
      "bidSize": 400,
      "bidTimestamp": "2026-05-06T20:00:00Z",
      "ask": "189.86",
      "askSize": 300,
      "askTimestamp": "2026-05-06T20:00:00Z",
      "volume": 52345678,
      "openInterest": 0,
      "previousClose": "188.50",
      "oneDayChange": { "change": "1.34", "percentChange": "0.71" },
      "optionDetails": null
    }
  ]
}
```

For **OPTION** type quotes, `optionDetails` is populated:
```json
{
  "optionDetails": {
    "greeks": {
      "delta": "0.5123",
      "gamma": "0.0234",
      "theta": "-0.0567",
      "vega": "0.3456",
      "rho": "0.0123",
      "impliedVolatility": "0.3245"
    },
    "strikePrice": "200.00",
    "midPrice": "5.25"
  }
}
```

**Key differences from Tradier**:
- POST not GET
- Requires `accountId` in URL path
- Prices returned as **strings**, not numbers — must `parseFloat()` everything
- Instrument objects use `{ symbol, type }` not just a symbol string
- Greeks field names differ: `impliedVolatility` (not `mid_iv`), no `bid_iv`/`ask_iv`/`smv_vol`/`phi`
- No `greeks: 'true'` parameter needed — Greeks are always included for options
- Option symbols use OCC format with spaces (e.g., `"AAPL  260516C00200000"`)
- Volume and openInterest are integers (not strings)

### Endpoint 2: Get Option Expirations

```
POST /userapigateway/marketdata/{accountId}/option-expirations
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "instrument": { "symbol": "AAPL", "type": "EQUITY" }
}
```

**Response**:
```json
{
  "baseSymbol": "AAPL",
  "expirations": ["2026-05-09", "2026-05-16", "2026-05-23", "2026-06-20"]
}
```

**Key differences from Tradier**:
- POST not GET
- Returns `{ baseSymbol, expirations: [...] }` not `{ expirations: { date: [...] } }`
- The expirations array is directly accessible — no need to unwrap nested object

### Endpoint 3: Get Option Chain

```
POST /userapigateway/marketdata/{accountId}/option-chain
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "instrument": { "symbol": "AAPL", "type": "EQUITY" },
  "expirationDate": "2026-05-16"
}
```

**Response**:
```json
{
  "baseSymbol": "AAPL",
  "calls": [
    {
      "instrument": { "symbol": "AAPL  260516C00180000", "type": "OPTION" },
      "outcome": "SUCCESS",
      "last": "10.50",
      "bid": "10.40",
      "bidSize": 50,
      "ask": "10.60",
      "askSize": 45,
      "volume": 1234,
      "openInterest": 5678,
      "previousClose": "10.20",
      "oneDayChange": { "change": "0.30", "percentChange": "2.94" },
      "optionDetails": {
        "greeks": {
          "delta": "0.6543",
          "gamma": "0.0198",
          "theta": "-0.0432",
          "vega": "0.2876",
          "rho": "0.0098",
          "impliedVolatility": "0.3456"
        },
        "strikePrice": "180.00",
        "midPrice": "10.50"
      }
    }
  ],
  "puts": [
    {
      "instrument": { "symbol": "AAPL  260516P00180000", "type": "OPTION" },
      "outcome": "SUCCESS",
      "last": "1.25",
      "bid": "1.20",
      "ask": "1.30",
      "volume": 890,
      "openInterest": 3456,
      "optionDetails": {
        "greeks": {
          "delta": "-0.3457",
          "gamma": "0.0198",
          "theta": "-0.0398",
          "vega": "0.2876",
          "rho": "-0.0087",
          "impliedVolatility": "0.3567"
        },
        "strikePrice": "180.00",
        "midPrice": "1.25"
      }
    }
  ]
}
```

**Key differences from Tradier**:
- POST not GET
- Chain is **pre-separated** into `calls[]` and `puts[]` arrays (Tradier returns a flat array with `option_type` field)
- Strike price is inside `optionDetails.strikePrice` (string), not a top-level `strike` (number)
- Greeks use `impliedVolatility` instead of `mid_iv`/`ask_iv`/`bid_iv`
- All prices are **strings** — must parse to numbers
- No `option_type` field — determined by which array (calls/puts) the item is in

### Endpoint 4: Historical Price Data — NOT AVAILABLE

Public.com does **not** provide a historical OHLC bars/candles endpoint. Tradier's `GET /markets/history` has no direct equivalent. Use **Yahoo Finance** for historical data (see Part 3).

---

## Part 3: Yahoo Finance Integration — News + Historical Data

### The Problem

1. **News**: The current system supports Benzinga, Alpha Vantage, and Polygon — all require paid API keys. Replace with Yahoo Finance free news.
2. **Historical Prices**: Public.com has no historical OHLC endpoint. Use Yahoo Finance for daily price history.

### Solution: Lightweight Python Proxy Server

Since `yfinance` is a Python library and this is a browser app, create a **lightweight local proxy** that the browser can call. This proxy serves both news and historical data.

#### Proxy Server: `proxy/server.py`

Create a new directory `proxy/` with a Python Flask/FastAPI server:

```python
# proxy/server.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
from datetime import datetime, timedelta
import uvicorn

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/news/{ticker}")
def get_news(ticker: str, count: int = Query(default=50, le=200)):
    """Fetch news headlines for a ticker from Yahoo Finance."""
    t = yf.Ticker(ticker)
    raw = t.news or []
    articles = []
    for item in raw[:count]:
        content = item.get("content", item)
        articles.append({
            "title": content.get("title", ""),
            "date": content.get("pubDate", content.get("providerPublishTime", "")),
            "source": content.get("provider", {}).get("displayName", "Yahoo Finance") if isinstance(content.get("provider"), dict) else "Yahoo Finance",
            "url": content.get("canonicalUrl", {}).get("url", content.get("link", "")) if isinstance(content.get("canonicalUrl"), dict) else content.get("link", ""),
            "tickers": [ticker],
            "sentiment": None,
        })
    return {"articles": articles}

@app.get("/api/history/{ticker}")
def get_history(
    ticker: str,
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    interval: str = Query(default="1d", description="1d, 1wk, 1mo"),
):
    """Fetch historical OHLC data for a ticker from Yahoo Finance."""
    t = yf.Ticker(ticker)
    df = t.history(start=start, end=end, interval=interval)
    if df.empty:
        return {"history": []}
    records = []
    for idx, row in df.iterrows():
        records.append({
            "date": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]),
        })
    return {"history": records}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8901)
```

#### Proxy Dependencies: `proxy/requirements.txt`

```
fastapi>=0.110.0
uvicorn>=0.29.0
yfinance>=1.3.0
```

#### Running the Proxy

```bash
cd proxy
pip install -r requirements.txt
python server.py
# Serves on http://localhost:8901
```

---

## Part 4: Detailed File-by-File Migration Instructions

### 4.1 — Replace `js/api/tradier.js` → `js/api/public.js`

**Delete** `js/api/tradier.js`. **Create** `js/api/public.js` that exposes a `PublicAPI` global IIFE with the **exact same public interface** as `TradierAPI`:

```
PublicAPI.getQuote(symbol)          → single equity quote object
PublicAPI.getQuotes(symbols)        → array of equity quote objects
PublicAPI.getOptionsExpirations(symbol) → array of date strings ["2026-05-09", ...]
PublicAPI.getOptionsChain(symbol, expiration) → flat array of option objects (call+put combined)
PublicAPI.getHistory(symbol, start, end, interval) → array of {date, open, high, low, close, volume}
PublicAPI.isOptionable(symbol)      → boolean
PublicAPI.requestCount()            → number
PublicAPI.resetCount()              → void
```

**Critical implementation details**:

1. **`_fetch()` internal helper**: All Public.com calls are **POST** (except the initial account fetch). Build a `_post(path, body, retries)` function:
   - URL: `Config.publicBaseUrl() + path` (with `{accountId}` interpolated from `Config.get('publicAccountId')`)
   - Headers: `{ Authorization: 'Bearer ' + Config.get('publicAccessToken'), 'Content-Type': 'application/json', Accept: 'application/json' }`
   - Rate-limit handling: Same exponential backoff pattern (1s/2s/4s, 3 retries on 429 or network error)
   - Request counter: Same `_requestCount` pattern

2. **`getQuote(symbol)`**: POST to `/userapigateway/marketdata/{accountId}/quotes` with body `{ instruments: [{ symbol, type: "EQUITY" }] }`. Parse the first quote from `response.quotes[0]`. **Normalize** the response to match the shape downstream code expects:
   ```javascript
   {
     symbol: quote.instrument.symbol,
     last: parseFloat(quote.last),
     prevclose: parseFloat(quote.previousClose),
     bid: parseFloat(quote.bid),
     ask: parseFloat(quote.ask),
     volume: quote.volume,
     change_percentage: parseFloat(quote.oneDayChange?.percentChange),
   }
   ```

3. **`getQuotes(symbols)`**: Same endpoint, batch symbols into chunks of **20** (to stay conservative with payload size). Build instruments array: `symbols.map(s => ({ symbol: s, type: "EQUITY" }))`. Normalize each quote in the response.

4. **`getOptionsExpirations(symbol)`**: POST to `/userapigateway/marketdata/{accountId}/option-expirations` with body `{ instrument: { symbol, type: "EQUITY" } }`. Return `response.expirations` directly (already an array of date strings).

5. **`getOptionsChain(symbol, expiration)`**: POST to `/userapigateway/marketdata/{accountId}/option-chain` with body `{ instrument: { symbol, type: "EQUITY" }, expirationDate: expiration }`. **Flatten** the response into a single array matching Tradier's shape:
   ```javascript
   const calls = (response.calls || []).map(c => _normalizeOption(c, 'call'));
   const puts = (response.puts || []).map(p => _normalizeOption(p, 'put'));
   return [...calls, ...puts];
   ```

   The `_normalizeOption(raw, type)` function must produce:
   ```javascript
   {
     symbol: raw.instrument.symbol,
     option_type: type,                              // 'call' or 'put'
     strike: parseFloat(raw.optionDetails.strikePrice),
     bid: parseFloat(raw.bid) || 0,
     ask: parseFloat(raw.ask) || 0,
     last: parseFloat(raw.last) || 0,
     volume: raw.volume || 0,
     open_interest: raw.openInterest || 0,
     greeks: {
       delta: parseFloat(raw.optionDetails?.greeks?.delta) || 0,
       gamma: parseFloat(raw.optionDetails?.greeks?.gamma) || 0,
       theta: parseFloat(raw.optionDetails?.greeks?.theta) || 0,
       vega: parseFloat(raw.optionDetails?.greeks?.vega) || 0,
       rho: parseFloat(raw.optionDetails?.greeks?.rho) || 0,
       mid_iv: parseFloat(raw.optionDetails?.greeks?.impliedVolatility) || 0,
       ask_iv: parseFloat(raw.optionDetails?.greeks?.impliedVolatility) || 0,
       bid_iv: parseFloat(raw.optionDetails?.greeks?.impliedVolatility) || 0,
       smv_vol: 0,    // Not available from Public.com
       phi: 0,        // Not available from Public.com
     },
   }
   ```
   **Note**: Public.com provides a single `impliedVolatility` value. Map it to `mid_iv`, `ask_iv`, AND `bid_iv` so downstream code that reads any of those fields still works. Set `smv_vol` and `phi` to 0 — they are used in `greeks.js` but only for display, not critical calculations.

6. **`getHistory(symbol, start, end, interval)`**: This calls the **Yahoo Finance proxy** (not Public.com). Fetch from `http://localhost:8901/api/history/{symbol}?start={start}&end={end}&interval=1d`. Return the `history` array from the response. Each record has `{ date, open, high, low, close, volume }` — this matches the Tradier format exactly (`prices[i].date`, `prices[i].close`, etc.).

   Add a configurable proxy base URL in config: `yahooProxyUrl` (default `http://localhost:8901`).

7. **`isOptionable(symbol)`**: Same logic — try `getOptionsExpirations`, return `exps.length > 0`.

### 4.2 — Replace `js/api/news.js`

**Rewrite** `js/api/news.js` to call the Yahoo Finance proxy:

```javascript
const NewsAPI = (() => {
  async function fetchNews(ticker, startDate, endDate) {
    const proxyUrl = Config.get('yahooProxyUrl') || 'http://localhost:8901';
    try {
      const resp = await fetch(`${proxyUrl}/api/news/${encodeURIComponent(ticker)}?count=50`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) throw new Error(`Yahoo proxy ${resp.status}`);
      const data = await resp.json();
      return (data.articles || []).map(a => ({
        title: a.title,
        date: a.date,
        source: a.source || 'Yahoo Finance',
        url: a.url,
        tickers: a.tickers || [ticker],
        sentiment: a.sentiment,  // null from proxy; will use _simpleSentiment in news-analysis.js
      }));
    } catch (err) {
      Logger.warn(`News fetch failed for ${ticker}: ${err.message}`);
      return [];
    }
  }

  return { fetchNews };
})();
```

**Key changes**:
- Remove all Benzinga/AlphaVantage/Polygon code
- Single provider (Yahoo Finance via proxy)
- No API key needed
- `sentiment` field comes as `null` from Yahoo — the existing `_simpleSentiment(title)` in `news-analysis.js` will handle sentiment scoring (no change needed there)
- Date filtering: Yahoo Finance returns recent news — the `startDate`/`endDate` parameters are passed for API consistency but Yahoo returns whatever it has. The existing `buildTimeline` in `news-analysis.js` already handles filtering articles by date range, so this is fine.

### 4.3 — Update `js/utils/config.js`

Replace Tradier-specific config with Public.com equivalents:

**DEFAULTS changes**:
```javascript
// REMOVE these:
tradierToken: '',
tradierEnv: 'sandbox',
newsProvider: 'none',
newsToken: '',

// ADD these:
publicAccessToken: '',
publicAccountId: '',
yahooProxyUrl: 'http://localhost:8901',
```

**Remove** these functions:
- `tradierBaseUrl()`
- `tradierHeaders()`

**Add** these functions:
```javascript
function publicBaseUrl() {
  return 'https://api.public.com';
}

function publicHeaders() {
  if (!_config) load();
  return {
    Authorization: `Bearer ${_config.publicAccessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
```

**Update the return statement**:
```javascript
return { load, save, get, publicBaseUrl, publicHeaders, DEFAULTS };
```

### 4.4 — Update `js/ui/settings.js`

Replace field ID references:
- `input-tradier-token` → `input-public-token`
- `input-tradier-env` → `input-public-account-id`
- `input-news-provider` → **REMOVE** (Yahoo Finance is the only provider now)
- `input-news-token` → `input-yahoo-proxy-url`

Update `save` call:
```javascript
Config.save({
  publicAccessToken: _getVal('input-public-token'),
  publicAccountId: _getVal('input-public-account-id'),
  yahooProxyUrl: _getVal('input-yahoo-proxy-url') || 'http://localhost:8901',
  autoRefreshSec: parseInt(_getVal('input-auto-refresh')) || 300,
  excludeIlliquid: _getChecked('input-exclude-illiquid'),
  useWhisper: _getChecked('input-use-whisper'),
});
```

Update `init` field population:
```javascript
_setVal('input-public-token', config.publicAccessToken);
_setVal('input-public-account-id', config.publicAccountId);
_setVal('input-yahoo-proxy-url', config.yahooProxyUrl);
```

### 4.5 — Update `index.html`

#### Settings Panel HTML

Replace the Tradier + news settings section (lines 40-64 approximately) with:

```html
<div class="form-group">
  <label for="input-public-token">Public.com Access Token</label>
  <input type="password" id="input-public-token" placeholder="Bearer access token…">
  <small>Generate at <a href="https://public.com/settings/security/api" target="_blank">public.com/settings/security/api</a>. Exchange your secret key for an access token.</small>
</div>
<div class="form-group">
  <label for="input-public-account-id">Public.com Account ID</label>
  <input type="text" id="input-public-account-id" placeholder="Account ID…">
  <small>Found via GET /userapigateway/trading/account after authenticating.</small>
</div>
<div class="form-group">
  <label for="input-yahoo-proxy-url">Yahoo Finance Proxy URL</label>
  <input type="text" id="input-yahoo-proxy-url" placeholder="http://localhost:8901">
  <small>Local proxy for news &amp; historical data. Run <code>python proxy/server.py</code> to start.</small>
</div>
```

Remove the news provider dropdown and news API key input entirely.

#### Script Tag

Change:
```html
<script src="js/api/tradier.js"></script>
```
To:
```html
<script src="js/api/public.js"></script>
```

### 4.6 — Update `js/app.js`

1. Replace `Config.get('tradierToken')` → `Config.get('publicAccessToken')`
2. Replace `TradierAPI.resetCount()` → `PublicAPI.resetCount()`
3. Replace `TradierAPI.requestCount()` → `PublicAPI.requestCount()`
4. Update the demo mode warning message: `'No Public.com API token configured. Click Settings to add your token.'`
5. In `_setupAutoRefresh`, replace `Config.get('tradierToken')` → `Config.get('publicAccessToken')`

### 4.7 — Update `js/analysis/pipeline.js`

Replace **every** `TradierAPI.*` call with `PublicAPI.*`:

| Line | Old | New |
|------|-----|-----|
| ~47 | `TradierAPI.isOptionable(s.ticker)` | `PublicAPI.isOptionable(s.ticker)` |
| ~72 | `TradierAPI.getQuotes(tickers)` | `PublicAPI.getQuotes(tickers)` |
| ~148 | `TradierAPI.getHistory(stock.ticker, startDate, endDate)` | `PublicAPI.getHistory(stock.ticker, startDate, endDate)` |

The `quoteMap` building logic stays the same since `PublicAPI.getQuotes()` normalizes to the same shape (each quote has `.symbol`).

### 4.8 — Update `js/analysis/implied-move.js`

Replace:
- `TradierAPI.getOptionsExpirations(ticker)` → `PublicAPI.getOptionsExpirations(ticker)`
- `TradierAPI.getOptionsChain(ticker, frontExpiry)` → `PublicAPI.getOptionsChain(ticker, frontExpiry)`

The chain data has been normalized in `public.js` to match Tradier's shape, so `_findATM()` and `_midPrice()` work unchanged:
- `o.option_type === 'call'` ✓ (normalized)
- `o.strike` ✓ (normalized from `optionDetails.strikePrice`)
- `o.bid`, `o.ask` ✓ (normalized from strings to numbers)
- `o.greeks.mid_iv`, `o.greeks.ask_iv` ✓ (normalized from `impliedVolatility`)

### 4.9 — Update `js/analysis/historical-moves.js`

Replace:
- `TradierAPI.getHistory(ticker, startDate, endDate)` → `PublicAPI.getHistory(ticker, startDate, endDate)`

The Yahoo Finance proxy returns the same `{ date, open, high, low, close, volume }` shape, so `_findMoveAroundDate()` and `_findLargeGaps()` work unchanged (they access `prices[i].date`, `prices[i].close`, `prices[i].open`).

### 4.10 — Update `js/analysis/term-structure.js`

Replace:
- `TradierAPI.getOptionsExpirations(ticker)` → `PublicAPI.getOptionsExpirations(ticker)`
- `TradierAPI.getOptionsChain(ticker, t1Expiry)` → `PublicAPI.getOptionsChain(ticker, t1Expiry)` (and same for t2)
- `TradierAPI.getQuote(ticker)` → `PublicAPI.getQuote(ticker)`

The `_getATMIV()` function accesses `o.option_type === 'call'` and `o.greeks.mid_iv` — both are normalized in `public.js`.

### 4.11 — Update `js/analysis/greeks.js`

Update the JSDoc comment from "Tradier's ORATS-backed Greeks" to "Public.com API Greeks".

The function signature `analyze(option, underlyingPrice, expectedMovePct)` and all internal field accesses (`g.delta`, `g.gamma`, `g.theta`, `g.vega`, `g.rho`, `g.phi`, `g.bid_iv`, `g.mid_iv`, `g.ask_iv`, `g.smv_vol`) continue to work because `public.js` normalizes option objects to include these fields (with `phi` and `smv_vol` set to 0).

### 4.12 — Update `js/analysis/iv-richness.js`

Update JSDoc comment from "ORATS-derived Greeks from Tradier" to "Public.com API". The function only uses `historicalPrices[i].close` — the Yahoo Finance proxy provides this field.

### 4.13 — Update `js/analysis/liquidity.js`

Update JSDoc comment from "Tradier option" to "option". The function only uses `option.bid`, `option.ask`, `option.open_interest`, `option.volume` — all normalized in `public.js`.

### 4.14 — Update `README.md`

- Replace all mentions of "Tradier" with "Public.com"
- Replace setup instructions with Public.com authentication flow
- Add Yahoo Finance proxy setup instructions
- Update rate limit section (Public.com: 10 req/s; Yahoo Finance: no hard limit but be respectful)
- Remove Benzinga/AlphaVantage/Polygon references
- Document the proxy dependency for local development

---

## Part 5: Public.com Order Limits Reference

While this application currently does **not** place orders, embed these limits as constants in `public.js` or a new `js/utils/order-limits.js` for future use:

### Equities

| Constraint | Limit |
|-----------|-------|
| Regular hours, whole shares | Min 1 share · Max 10,000 shares ($5M) |
| Regular hours, fractional | Min $5 notional · Max $250,000 |
| Extended hours | Whole shares only · Max 10,000 shares |
| OTC | Whole shares only · Max 10,000 shares ($1M) |
| Price ≥ $1 | 2 decimal places |
| Price < $1 | 4 decimal places |

### Options

| Constraint | Limit |
|-----------|-------|
| Minimum | 1 contract |
| Equity options | Max 1,999 contracts |
| Index options (market / stop) | Max 999 contracts |
| Index options (limit / stop-limit) | Max 1,999 contracts |
| Special symbols (SPY, QQQ) | Max 1,499 contracts |
| Multi-leg | Up to 6 legs |
| Market orders | Max $50,000 |
| Stop / limit orders | Max $500,000 |
| Price < $3 | $0.01 increments |
| Price ≥ $3 | $0.05 increments |

Store these as a frozen object:
```javascript
const PUBLIC_ORDER_LIMITS = Object.freeze({
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
```

---

## Part 6: Data Shape Normalization Quick Reference

### Quote Object (what downstream code expects)

```javascript
{
  symbol: "AAPL",           // string
  last: 189.84,             // number (parseFloat from Public.com string)
  prevclose: 188.50,        // number (mapped from previousClose)
  bid: 189.82,              // number
  ask: 189.86,              // number
  volume: 52345678,         // number
  change_percentage: 0.71,  // number (mapped from oneDayChange.percentChange)
}
```

### Option Object (what downstream code expects)

```javascript
{
  symbol: "AAPL260516C00200000",   // string
  option_type: "call",             // "call" or "put"
  strike: 200.00,                  // number
  bid: 5.20,                       // number
  ask: 5.30,                       // number
  last: 5.25,                      // number
  volume: 1234,                    // number
  open_interest: 5678,             // number
  greeks: {
    delta: 0.5123,
    gamma: 0.0234,
    theta: -0.0567,
    vega: 0.3456,
    rho: 0.0123,
    phi: 0,                        // not available from Public.com
    mid_iv: 0.3245,                // mapped from impliedVolatility
    ask_iv: 0.3245,                // same value
    bid_iv: 0.3245,                // same value
    smv_vol: 0,                    // not available from Public.com
  },
}
```

### History Record (what downstream code expects)

```javascript
{
  date: "2026-05-06",    // string YYYY-MM-DD
  open: 188.50,          // number
  high: 190.20,          // number
  low: 188.10,           // number
  close: 189.84,         // number
  volume: 52345678,      // number
}
```

### News Article (what downstream code expects)

```javascript
{
  title: "Apple Beats Q2 Estimates",   // string
  date: "2026-05-05T14:30:00Z",       // string (ISO 8601 or similar)
  source: "Yahoo Finance",             // string
  url: "https://...",                   // string
  tickers: ["AAPL"],                   // string[]
  sentiment: null,                      // number|null (null triggers _simpleSentiment)
}
```

---

## Part 7: Testing Checklist

After completing the migration, verify each of these scenarios:

### API Layer Tests
- [ ] `PublicAPI.getQuote("AAPL")` returns a normalized quote with numeric `last`, `prevclose`
- [ ] `PublicAPI.getQuotes(["AAPL","MSFT","GOOGL"])` returns array of normalized quotes
- [ ] `PublicAPI.getOptionsExpirations("AAPL")` returns array of date strings
- [ ] `PublicAPI.getOptionsChain("AAPL", "2026-05-16")` returns flat array of normalized options with `option_type`, `strike`, `greeks.mid_iv`
- [ ] `PublicAPI.getHistory("AAPL", "2025-05-01", "2026-05-01")` returns array of `{date, close, ...}` records
- [ ] `PublicAPI.isOptionable("AAPL")` returns `true`
- [ ] `PublicAPI.isOptionable("INVALIDTICKER")` returns `false`
- [ ] Rate-limit retry works (simulate 429)
- [ ] Request counter increments correctly

### News Tests
- [ ] `NewsAPI.fetchNews("AAPL", "2026-04-28", "2026-05-06")` returns articles with title, date, source
- [ ] News returns `[]` gracefully if proxy is not running (no crash)
- [ ] `_simpleSentiment` in `news-analysis.js` still scores sentiment from titles correctly

### Pipeline Integration Tests
- [ ] Full pipeline runs with demo data (no API token) — demo mode works
- [ ] Full pipeline runs with real Public.com token — fetches live data
- [ ] IV Richness calculation uses historical data from Yahoo Finance proxy
- [ ] Historical Moves analysis uses Yahoo Finance historical data
- [ ] Term Structure fetches two expirations and chain data from Public.com
- [ ] Greeks display in trade cards (delta, gamma, theta, vega are populated)
- [ ] Liquidity screen reads bid/ask/OI from normalized option data
- [ ] News timeline populates in trade cards

### Settings UI Tests
- [ ] Settings panel shows Public.com token, account ID, proxy URL fields
- [ ] Save & Reload triggers re-analysis with new credentials
- [ ] Config persists to localStorage with new key names

### Error Handling Tests
- [ ] Missing access token shows clear error message
- [ ] Invalid account ID returns meaningful error
- [ ] Yahoo proxy down degrades gracefully (news = `[]`, history = `[]`)
- [ ] Network timeout after 3 retries shows error

---

## Part 8: Migration Order (Recommended Sequence)

1. **Create `proxy/server.py` and `proxy/requirements.txt`** — get the Yahoo Finance proxy running first
2. **Update `js/utils/config.js`** — new config keys, remove Tradier helpers, add Public.com helpers
3. **Create `js/api/public.js`** — the new API client with full normalization layer
4. **Rewrite `js/api/news.js`** — Yahoo Finance proxy integration
5. **Update `index.html`** — new script tag, new settings HTML
6. **Update `js/ui/settings.js`** — new field IDs and config keys
7. **Update `js/app.js`** — replace all Tradier references
8. **Update `js/analysis/pipeline.js`** — replace all `TradierAPI.*` → `PublicAPI.*`
9. **Update `js/analysis/implied-move.js`** — API call replacements
10. **Update `js/analysis/historical-moves.js`** — API call replacement
11. **Update `js/analysis/term-structure.js`** — API call replacements
12. **Update `js/analysis/greeks.js`** — JSDoc comment
13. **Update `js/analysis/iv-richness.js`** — JSDoc comment
14. **Update `js/analysis/liquidity.js`** — JSDoc comment
15. **Delete `js/api/tradier.js`**
16. **Update `README.md`** — full documentation update
17. **Run full testing checklist**

---

## Part 9: Key Gotchas & Edge Cases

1. **String-to-number parsing**: Public.com returns ALL prices as strings. Every `last`, `bid`, `ask`, `previousClose`, `strikePrice`, Greek values, etc. must be `parseFloat()`'d. Missing or null values should default to `0`.

2. **POST vs GET**: All Public.com market data endpoints are **POST** with JSON body. Tradier was all **GET** with query params. The `_fetch` helper must change fundamentally.

3. **Account ID in URL**: Every Public.com market data URL includes `{accountId}`. Store this in config and interpolate it into every request path.

4. **Token expiry**: Public.com access tokens expire (default 60 minutes). The app should handle 401 responses gracefully. Consider adding a token refresh mechanism or at minimum a clear error message instructing the user to regenerate their token.

5. **No historical data from Public.com**: This is the biggest architectural difference. The Yahoo Finance proxy is **required** for the app to function fully (IV Richness and Historical Moves depend on price history). When the proxy is down, those features should degrade gracefully with warnings, not crash the pipeline.

6. **Greeks differences**: Public.com provides fewer Greek values than Tradier's ORATS integration. Specifically missing: `bid_iv`, `ask_iv` (separate values), `smv_vol`, `phi`. The normalization layer maps `impliedVolatility` to all three IV fields and zeros out the missing ones. Display code in `greeks.js` will show `0` for `phi` and `smvVol` — consider hiding those fields in the trade card UI or marking them as "N/A".

7. **Option chain structure**: Tradier returns a flat array; Public.com returns separate `calls[]` and `puts[]`. The normalization in `public.js` must flatten them and add `option_type` to each object.

8. **CORS**: Public.com's API may require CORS headers for browser requests. If CORS issues arise, the Yahoo Finance proxy can also serve as a reverse proxy for Public.com calls. Add an optional `publicProxyUrl` config that, when set, routes Public.com calls through the local proxy instead of directly.

9. **Demo mode**: The demo mode in `app.js` generates fake data and does NOT call any API. It must still work after migration — just update the config key checks and error messages.

10. **Yahoo Finance rate limits**: `yfinance` scrapes Yahoo Finance and has no official rate limit, but aggressive usage can trigger throttling. The proxy should implement basic caching (e.g., news cached for 5 minutes per ticker, history cached for 1 hour per ticker+range).
