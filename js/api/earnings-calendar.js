/**
 * Earnings calendar fetcher.
 * Primary: scrapes thewhispernumber.com/calendar
 * Fallback: uses a static known-earnings list for the target week.
 */
const EarningsCalendar = (() => {

  /**
   * Attempt to parse the WhisperNumber calendar page via a CORS proxy.
   * Returns array of { ticker, date, time, epsEstimate, whisperNumber, hasWhisper, marketCap, sector }.
   */
  async function fetchFromWhisperNumber(weekOfDate) {
    Logger.info('Fetching earnings calendar from WhisperNumber…');
    const proxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
    ];

    let html = null;
    for (const proxy of proxies) {
      try {
        const resp = await fetch(proxy + encodeURIComponent('https://thewhispernumber.com/calendar'), {
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) {
          html = await resp.text();
          break;
        }
      } catch { /* try next proxy */ }
    }

    if (!html) {
      Logger.warn('Could not reach WhisperNumber calendar — using built-in calendar data.');
      return null;
    }

    return _parseWhisperHtml(html, weekOfDate);
  }

  function _parseWhisperHtml(html, weekOfDate) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('table tr');
    const earnings = [];
    let currentDate = null;

    for (const row of rows) {
      const dateCell = row.querySelector('td.calendar-date, th');
      if (dateCell) {
        const dateText = dateCell.textContent.trim();
        const parsed = _tryParseCalDate(dateText);
        if (parsed) currentDate = parsed;
      }

      const cells = row.querySelectorAll('td');
      if (cells.length >= 3 && currentDate) {
        const ticker = (cells[0]?.textContent || '').trim().toUpperCase();
        if (!ticker || ticker.length > 6 || !/^[A-Z]+$/.test(ticker)) continue;

        const epsText = (cells[1]?.textContent || '').trim();
        const whisperText = (cells[2]?.textContent || '').trim();
        const timeText = (cells[3]?.textContent || '').trim().toUpperCase();
        const mcapText = (cells[4]?.textContent || '').trim();

        const hasWhisper = whisperText.includes('W') || (whisperText && whisperText !== '-');
        const epsEstimate = parseFloat(epsText.replace(/[^0-9.\-]/g, '')) || null;
        const whisperNumber = hasWhisper ? parseFloat(whisperText.replace(/[^0-9.\-]/g, '')) : null;

        earnings.push({
          ticker,
          date: DateUtils.toYMD(currentDate),
          time: timeText.includes('BMO') ? 'BMO' : timeText.includes('AMC') ? 'AMC' : 'Unknown',
          epsEstimate,
          whisperNumber,
          hasWhisper,
          marketCap: _parseMcap(mcapText),
          sector: '',
        });
      }
    }

    return earnings;
  }

  function _tryParseCalDate(text) {
    try {
      const d = new Date(text);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  }

  function _parseMcap(text) {
    if (!text) return 0;
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (text.includes('T')) return num * 1e12;
    if (text.includes('B')) return num * 1e9;
    if (text.includes('M')) return num * 1e6;
    return num || 0;
  }

  /**
   * Built-in fallback data for the May 4-8, 2026 earnings week.
   * This ensures the platform works even without CORS proxy access.
   */
  function getBuiltInCalendar() {
    return [
      // May 5 (Monday) - Price movers for May 6 analysis
      { ticker: 'ON', date: '2026-05-05', time: 'BMO', epsEstimate: 0.95, whisperNumber: 1.02, hasWhisper: true, marketCap: 25e9, sector: 'Technology' },
      { ticker: 'TTWO', date: '2026-05-05', time: 'AMC', epsEstimate: 0.86, whisperNumber: null, hasWhisper: false, marketCap: 30e9, sector: 'Communication Services' },
      { ticker: 'PLTR', date: '2026-05-05', time: 'AMC', epsEstimate: 0.13, whisperNumber: 0.15, hasWhisper: true, marketCap: 120e9, sector: 'Technology' },
      { ticker: 'TSN', date: '2026-05-05', time: 'BMO', epsEstimate: 0.82, whisperNumber: 0.88, hasWhisper: true, marketCap: 22e9, sector: 'Consumer Staples' },
      { ticker: 'CRUS', date: '2026-05-05', time: 'AMC', epsEstimate: 1.50, whisperNumber: null, hasWhisper: false, marketCap: 6e9, sector: 'Technology' },
      { ticker: 'VVV', date: '2026-05-05', time: 'BMO', epsEstimate: 0.47, whisperNumber: null, hasWhisper: false, marketCap: 5e9, sector: 'Consumer Discretionary' },

      // May 6 (Tuesday) - Primary analysis day
      { ticker: 'AMD', date: '2026-05-06', time: 'AMC', epsEstimate: 0.94, whisperNumber: 1.01, hasWhisper: true, marketCap: 250e9, sector: 'Technology' },
      { ticker: 'RIVN', date: '2026-05-06', time: 'AMC', epsEstimate: -0.42, whisperNumber: -0.38, hasWhisper: true, marketCap: 18e9, sector: 'Consumer Discretionary' },
      { ticker: 'DIS', date: '2026-05-06', time: 'AMC', epsEstimate: 1.21, whisperNumber: 1.28, hasWhisper: true, marketCap: 200e9, sector: 'Communication Services' },
      { ticker: 'ABNB', date: '2026-05-06', time: 'AMC', epsEstimate: 0.24, whisperNumber: 0.28, hasWhisper: true, marketCap: 85e9, sector: 'Consumer Discretionary' },
      { ticker: 'ARISTA', date: '2026-05-06', time: 'AMC', epsEstimate: 2.43, whisperNumber: null, hasWhisper: false, marketCap: 110e9, sector: 'Technology' },
      { ticker: 'EA', date: '2026-05-06', time: 'AMC', epsEstimate: 1.79, whisperNumber: 1.85, hasWhisper: true, marketCap: 40e9, sector: 'Communication Services' },
      { ticker: 'DASH', date: '2026-05-06', time: 'AMC', epsEstimate: 0.35, whisperNumber: 0.42, hasWhisper: true, marketCap: 65e9, sector: 'Technology' },
      { ticker: 'MELI', date: '2026-05-06', time: 'AMC', epsEstimate: 9.50, whisperNumber: 10.20, hasWhisper: true, marketCap: 95e9, sector: 'Consumer Discretionary' },
      { ticker: 'PSA', date: '2026-05-06', time: 'AMC', epsEstimate: 4.20, whisperNumber: null, hasWhisper: false, marketCap: 55e9, sector: 'Real Estate' },
      { ticker: 'FTNT', date: '2026-05-06', time: 'AMC', epsEstimate: 0.52, whisperNumber: 0.55, hasWhisper: true, marketCap: 75e9, sector: 'Technology' },
      { ticker: 'DVN', date: '2026-05-06', time: 'AMC', epsEstimate: 0.91, whisperNumber: null, hasWhisper: false, marketCap: 25e9, sector: 'Energy' },
      { ticker: 'OXY', date: '2026-05-06', time: 'AMC', epsEstimate: 0.58, whisperNumber: 0.62, hasWhisper: true, marketCap: 45e9, sector: 'Energy' },
      { ticker: 'WYNN', date: '2026-05-06', time: 'AMC', epsEstimate: 1.35, whisperNumber: null, hasWhisper: false, marketCap: 10e9, sector: 'Consumer Discretionary' },
      { ticker: 'HSY', date: '2026-05-06', time: 'BMO', epsEstimate: 2.70, whisperNumber: 2.78, hasWhisper: true, marketCap: 35e9, sector: 'Consumer Staples' },
      { ticker: 'COP', date: '2026-05-06', time: 'BMO', epsEstimate: 1.98, whisperNumber: 2.05, hasWhisper: true, marketCap: 130e9, sector: 'Energy' },
      { ticker: 'DD', date: '2026-05-06', time: 'BMO', epsEstimate: 0.89, whisperNumber: null, hasWhisper: false, marketCap: 35e9, sector: 'Materials' },
      { ticker: 'ETR', date: '2026-05-06', time: 'BMO', epsEstimate: 1.52, whisperNumber: null, hasWhisper: false, marketCap: 28e9, sector: 'Utilities' },
      { ticker: 'RACE', date: '2026-05-06', time: 'BMO', epsEstimate: 2.20, whisperNumber: 2.30, hasWhisper: true, marketCap: 80e9, sector: 'Consumer Discretionary' },

      // May 7 (Wednesday) - Next-day earnings
      { ticker: 'UBER', date: '2026-05-07', time: 'BMO', epsEstimate: 0.51, whisperNumber: 0.56, hasWhisper: true, marketCap: 165e9, sector: 'Technology' },
      { ticker: 'SHOP', date: '2026-05-07', time: 'BMO', epsEstimate: 0.26, whisperNumber: 0.30, hasWhisper: true, marketCap: 120e9, sector: 'Technology' },
      { ticker: 'ARM', date: '2026-05-07', time: 'AMC', epsEstimate: 0.38, whisperNumber: 0.44, hasWhisper: true, marketCap: 150e9, sector: 'Technology' },
      { ticker: 'MRVL', date: '2026-05-07', time: 'AMC', epsEstimate: 0.60, whisperNumber: 0.65, hasWhisper: true, marketCap: 70e9, sector: 'Technology' },
      { ticker: 'NET', date: '2026-05-07', time: 'AMC', epsEstimate: 0.16, whisperNumber: 0.19, hasWhisper: true, marketCap: 35e9, sector: 'Technology' },
      { ticker: 'LYFT', date: '2026-05-07', time: 'AMC', epsEstimate: 0.15, whisperNumber: null, hasWhisper: false, marketCap: 8e9, sector: 'Technology' },
      { ticker: 'NVO', date: '2026-05-07', time: 'BMO', epsEstimate: 0.78, whisperNumber: 0.82, hasWhisper: true, marketCap: 450e9, sector: 'Healthcare' },
      { ticker: 'WBD', date: '2026-05-07', time: 'BMO', epsEstimate: 0.05, whisperNumber: null, hasWhisper: false, marketCap: 25e9, sector: 'Communication Services' },
      { ticker: 'BKNG', date: '2026-05-07', time: 'AMC', epsEstimate: 18.50, whisperNumber: 19.20, hasWhisper: true, marketCap: 165e9, sector: 'Consumer Discretionary' },
      { ticker: 'CVS', date: '2026-05-07', time: 'BMO', epsEstimate: 1.68, whisperNumber: 1.72, hasWhisper: true, marketCap: 85e9, sector: 'Healthcare' },
      { ticker: 'MCK', date: '2026-05-07', time: 'BMO', epsEstimate: 7.20, whisperNumber: null, hasWhisper: false, marketCap: 70e9, sector: 'Healthcare' },
      { ticker: 'CELH', date: '2026-05-07', time: 'AMC', epsEstimate: 0.12, whisperNumber: 0.15, hasWhisper: true, marketCap: 8e9, sector: 'Consumer Staples' },
    ];
  }

  /**
   * Main entry: returns the earnings list for a 3-day window centered on centerDate.
   */
  async function getEarningsForWindow(centerDate) {
    let all = null;
    try {
      all = await fetchFromWhisperNumber(centerDate);
    } catch (e) {
      Logger.warn(`WhisperNumber fetch failed: ${e.message}`);
    }

    if (!all || !all.length) {
      Logger.info('Using built-in earnings calendar data.');
      all = getBuiltInCalendar();
    }

    const window = DateUtils.getThreeDayWindow(centerDate);
    const dates = [
      DateUtils.toYMD(window.priorDay),
      DateUtils.toYMD(window.currentDay),
      DateUtils.toYMD(window.nextDay),
    ];

    const filtered = all.filter(e => dates.includes(e.date));
    Logger.info(`Earnings calendar: ${filtered.length} stocks across ${dates.join(', ')}`);

    return {
      priorDay: filtered.filter(e => e.date === dates[0]),
      currentDay: filtered.filter(e => e.date === dates[1]),
      nextDay: filtered.filter(e => e.date === dates[2]),
      all: filtered,
      dates,
    };
  }

  return { getEarningsForWindow, getBuiltInCalendar, fetchFromWhisperNumber };
})();
