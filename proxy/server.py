"""
Yahoo Finance proxy server for EarningsEdge Pro.
Serves news headlines and historical OHLC data via yfinance.
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import uvicorn
import time
from threading import Lock

app = FastAPI(title="EarningsEdge Yahoo Finance Proxy")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {}
_cache_lock = Lock()
NEWS_TTL = 300        # 5 minutes
HISTORY_TTL = 3600    # 1 hour


def _get_cached(key, ttl):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < ttl:
            return entry["data"]
    return None


def _set_cached(key, data):
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}


@app.get("/api/news/{ticker}")
def get_news(ticker: str, count: int = Query(default=50, le=200)):
    """Fetch news headlines for a ticker from Yahoo Finance."""
    cache_key = f"news:{ticker}:{count}"
    cached = _get_cached(cache_key, NEWS_TTL)
    if cached is not None:
        return cached

    t = yf.Ticker(ticker)
    raw = t.news or []
    articles = []
    for item in raw[:count]:
        content = item.get("content", item)
        if isinstance(content.get("provider"), dict):
            source = content["provider"].get("displayName", "Yahoo Finance")
        else:
            source = "Yahoo Finance"
        if isinstance(content.get("canonicalUrl"), dict):
            url = content["canonicalUrl"].get("url", content.get("link", ""))
        else:
            url = content.get("link", "")
        articles.append({
            "title": content.get("title", ""),
            "date": content.get("pubDate", content.get("providerPublishTime", "")),
            "source": source,
            "url": url,
            "tickers": [ticker],
            "sentiment": None,
        })

    result = {"articles": articles}
    _set_cached(cache_key, result)
    return result


@app.get("/api/history/{ticker}")
def get_history(
    ticker: str,
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    interval: str = Query(default="1d", description="1d, 1wk, 1mo"),
):
    """Fetch historical OHLC data for a ticker from Yahoo Finance."""
    cache_key = f"history:{ticker}:{start}:{end}:{interval}"
    cached = _get_cached(cache_key, HISTORY_TTL)
    if cached is not None:
        return cached

    t = yf.Ticker(ticker)
    df = t.history(start=start, end=end, interval=interval)
    if df.empty:
        result = {"history": []}
        _set_cached(cache_key, result)
        return result

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

    result = {"history": records}
    _set_cached(cache_key, result)
    return result


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8901)
