/**
 * News API integration — supports Benzinga, Alpha Vantage, Polygon.
 * Falls back gracefully if no API key is configured.
 */
const NewsAPI = (() => {

  async function fetchNews(ticker, startDate, endDate) {
    const provider = Config.get('newsProvider');
    const token = Config.get('newsToken');

    if (provider === 'none' || !token) {
      Logger.dim(`News: skipped for ${ticker} (no provider configured)`);
      return [];
    }

    try {
      switch (provider) {
        case 'benzinga': return await _benzinga(ticker, startDate, endDate, token);
        case 'alphavantage': return await _alphaVantage(ticker, token);
        case 'polygon': return await _polygon(ticker, startDate, endDate, token);
        default: return [];
      }
    } catch (err) {
      Logger.warn(`News fetch failed for ${ticker}: ${err.message}`);
      return [];
    }
  }

  async function _benzinga(ticker, start, end, token) {
    const url = `https://api.benzinga.com/api/v2/news?tickers=${ticker}&dateFrom=${start}&dateTo=${end}&pageSize=50&token=${token}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Benzinga ${resp.status}`);
    const data = await resp.json();
    return (data || []).map(a => ({
      title: a.title,
      date: a.created,
      source: 'Benzinga',
      url: a.url,
      tickers: a.stocks?.map(s => s.name) || [ticker],
    }));
  }

  async function _alphaVantage(ticker, token) {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&apikey=${token}&limit=50`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`AlphaVantage ${resp.status}`);
    const data = await resp.json();
    return (data.feed || []).map(a => ({
      title: a.title,
      date: a.time_published,
      source: a.source,
      url: a.url,
      sentiment: a.overall_sentiment_score,
      tickers: a.ticker_sentiment?.map(t => t.ticker) || [ticker],
    }));
  }

  async function _polygon(ticker, start, end, token) {
    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&published_utc.gte=${start}&published_utc.lte=${end}&limit=50&apiKey=${token}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Polygon ${resp.status}`);
    const data = await resp.json();
    return (data.results || []).map(a => ({
      title: a.title,
      date: a.published_utc,
      source: a.publisher?.name || 'Polygon',
      url: a.article_url,
      tickers: a.tickers || [ticker],
    }));
  }

  return { fetchNews };
})();
