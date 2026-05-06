/**
 * News API integration — fetches headlines from Yahoo Finance via local proxy.
 */
const NewsAPI = (() => {

  async function fetchNews(ticker, startDate, endDate) {
    const proxyUrl = Config.get('yahooProxyUrl') || 'http://localhost:8901';
    try {
      const resp = await fetch(
        `${proxyUrl}/api/news/${encodeURIComponent(ticker)}?count=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!resp.ok) throw new Error(`Yahoo proxy ${resp.status}`);
      const data = await resp.json();
      return (data.articles || []).map(a => ({
        title: a.title,
        date: a.date,
        source: a.source || 'Yahoo Finance',
        url: a.url,
        tickers: a.tickers || [ticker],
        sentiment: a.sentiment,
      }));
    } catch (err) {
      Logger.warn(`News fetch failed for ${ticker}: ${err.message}`);
      return [];
    }
  }

  return { fetchNews };
})();
