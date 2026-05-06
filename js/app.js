/**
 * Main Application Entry Point
 * Orchestrates the full earnings analysis platform.
 */
const App = (() => {
  let _earningsData = null;
  let _results = [];
  let _currentDate = null;
  let _autoRefreshTimer = null;

  async function init() {
    Logger.info('EarningsEdge Pro initializing…');

    Config.load();
    Settings.init();

    _currentDate = new Date();
    _buildDateTabs();
    _bindViewTabs();
    _bindFilterEvents();
    _updateMarketStatus();
    setInterval(_updateMarketStatus, 60000);

    document.getElementById('btn-refresh')?.addEventListener('click', runAnalysis);

    const token = Config.get('tradierToken');
    if (token) {
      await runAnalysis();
    } else {
      Logger.warn('No Tradier API token configured. Click Settings to add your token.');
      _showDemoMode();
    }

    _setupAutoRefresh();
    Logger.info('Application ready.');
  }

  async function runAnalysis() {
    const loading = document.getElementById('loading-overlay');
    const progressFill = document.getElementById('progress-fill');
    const loadingMsg = document.getElementById('loading-message');
    const loadingDetail = document.getElementById('loading-detail');

    loading?.classList.remove('hidden');
    TradierAPI.resetCount();
    Logger.clear();
    Logger.info(`Starting analysis for ${DateUtils.formatDisplay(_currentDate)}`);

    const onProgress = (pct, msg) => {
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (loadingMsg) loadingMsg.textContent = msg;
      if (loadingDetail) loadingDetail.textContent = `API calls: ${TradierAPI.requestCount()}`;
    };

    try {
      onProgress(2, 'Fetching earnings calendar…');
      _earningsData = await EarningsCalendar.getEarningsForWindow(DateUtils.toYMD(_currentDate));

      onProgress(5, 'Running analysis pipeline…');
      _results = await Pipeline.run(_earningsData, onProgress);

      _renderAll();
      onProgress(100, 'Complete!');

      const ts = new Date().toLocaleTimeString();
      const refreshEl = document.getElementById('last-refresh');
      if (refreshEl) refreshEl.textContent = `Updated ${ts}`;
    } catch (err) {
      Logger.error(`Pipeline failed: ${err.message}`);
      onProgress(100, `Error: ${err.message}`);
    }

    setTimeout(() => loading?.classList.add('hidden'), 800);
  }

  function _renderAll() {
    Dashboard.render(_results, _earningsData);
    TradeCardsUI.render(_results);
    Charts.renderIVHeatmap(_results);
    Charts.renderSectorCorrelation(_results);

    const netTab = document.querySelector('[data-view="network"]');
    if (netTab?.classList.contains('active') || document.getElementById('view-network')?.classList.contains('active')) {
      _initNetwork();
    }
  }

  function _initNetwork() {
    NetworkGraph.init();
    NetworkGraph.buildFromResults(_results);
  }

  function _buildDateTabs() {
    const container = document.getElementById('date-tabs');
    if (!container) return;

    const window3d = DateUtils.getThreeDayWindow(_currentDate);
    const dates = [window3d.priorDay, window3d.currentDay, window3d.nextDay];
    const labels = ['Prior Day', 'Today', 'Next Day'];

    container.innerHTML = dates.map((d, i) => {
      const active = i === 1 ? 'active' : '';
      return `<button class="date-tab ${active}" data-date="${DateUtils.toYMD(d)}">
        ${labels[i]}<br><small>${DateUtils.formatDisplay(d)}</small>
      </button>`;
    }).join('');

    container.querySelectorAll('.date-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _currentDate = DateUtils.parseYMD(tab.dataset.date);
        runAnalysis();
      });
    });

    document.getElementById('btn-prev-day')?.addEventListener('click', () => {
      _currentDate = DateUtils.prevBusinessDay(_currentDate);
      _buildDateTabs();
      runAnalysis();
    });

    document.getElementById('btn-next-day')?.addEventListener('click', () => {
      _currentDate = DateUtils.nextBusinessDay(_currentDate);
      _buildDateTabs();
      runAnalysis();
    });
  }

  function _bindViewTabs() {
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        tab.classList.add('active');
        const viewId = `view-${tab.dataset.view}`;
        document.getElementById(viewId)?.classList.remove('hidden');

        if (tab.dataset.view === 'network') {
          setTimeout(() => _initNetwork(), 100);
        }
      });
    });
  }

  function _bindFilterEvents() {
    const filterTicker = document.getElementById('filter-ticker');
    const filterTier = document.getElementById('filter-tier');
    const sortCards = document.getElementById('sort-cards');

    const applyFilter = () => TradeCardsUI.applyFilters(_results);
    filterTicker?.addEventListener('input', applyFilter);
    filterTier?.addEventListener('change', applyFilter);
    sortCards?.addEventListener('change', applyFilter);
  }

  function _updateMarketStatus() {
    const badge = document.getElementById('market-status');
    if (!badge) return;
    if (DateUtils.isMarketOpen()) {
      badge.textContent = 'Market Open';
      badge.classList.add('open');
    } else {
      badge.textContent = 'Market Closed';
      badge.classList.remove('open');
    }
  }

  function _setupAutoRefresh() {
    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    const sec = Config.get('autoRefreshSec') || 300;
    _autoRefreshTimer = setInterval(() => {
      if (DateUtils.isMarketOpen() && Config.get('tradierToken')) {
        Logger.info('Auto-refresh triggered');
        runAnalysis();
      }
    }, sec * 1000);
  }

  function _showDemoMode() {
    Logger.info('Running in demo mode with built-in calendar data…');
    _earningsData = {
      priorDay: EarningsCalendar.getBuiltInCalendar().filter(s => s.date === '2026-05-05'),
      currentDay: EarningsCalendar.getBuiltInCalendar().filter(s => s.date === '2026-05-06'),
      nextDay: EarningsCalendar.getBuiltInCalendar().filter(s => s.date === '2026-05-07'),
      all: EarningsCalendar.getBuiltInCalendar(),
      dates: ['2026-05-05', '2026-05-06', '2026-05-07'],
    };

    _results = _earningsData.all.map(s => {
      const tier = Pipeline.classifyTier(s);
      const mockIV = 0.3 + Math.random() * 0.4;
      const mockMove = 3 + Math.random() * 8;
      return {
        ...s,
        tier,
        currentPrice: (20 + Math.random() * 280).toFixed(2),
        impliedMove: {
          impliedMovePct: MathUtils.round(mockMove, 2),
          impliedMoveDollar: MathUtils.round(mockMove * 1.5, 2),
          straddlePrice: MathUtils.round(mockMove * 1.5, 2),
          stddevMovePct: MathUtils.round(mockMove * 0.8, 2),
          upperPrice: MathUtils.round(100 + mockMove * 1.5, 2),
          lowerPrice: MathUtils.round(100 - mockMove * 1.5, 2),
          avgIV: mockIV,
          callPrice: MathUtils.round(mockMove * 0.8, 2),
          putPrice: MathUtils.round(mockMove * 0.7, 2),
          atmStrike: 100,
        },
        ivRichness: {
          currentIVPct: MathUtils.round(mockIV * 100, 2),
          ivPercentile: MathUtils.round(20 + Math.random() * 70, 1),
          ivRank: MathUtils.round(20 + Math.random() * 60, 1),
          classification: ['underpriced', 'fair', 'overpriced', 'severely-overpriced'][Math.floor(Math.random() * 4)],
          classificationLabel: ['Underpriced', 'Fair', 'Overpriced', 'Severely Overpriced'][Math.floor(Math.random() * 4)],
        },
        historicalMoves: {
          avgMove: MathUtils.round(2 + Math.random() * 6, 2),
          maxMove: MathUtils.round(5 + Math.random() * 10, 2),
          minMove: MathUtils.round(0.5 + Math.random() * 2, 2),
          count: 4 + Math.floor(Math.random() * 5),
          directionalMoves: Array.from({ length: 4 }, () => MathUtils.round(-5 + Math.random() * 10, 2)),
        },
        newsTimeline: { articles: [], bullish: 0, bearish: 0, neutral: 0, avgSentiment: 0 },
        recommendation: {
          strategy: ['Long Straddle', 'Short Straddle', 'Iron Condor', 'Bull Call Spread'][Math.floor(Math.random() * 4)],
          rationale: 'Demo mode — connect Tradier API for live analysis.',
          secondary: 'Iron Condor',
          entryLimit: MathUtils.round(mockMove * 1.5, 2),
          maxLoss: MathUtils.round(mockMove * 1.5, 2),
          maxGain: MathUtils.round(mockMove * 4, 2),
          profitProb: 45 + Math.floor(Math.random() * 20),
          expectedValue: MathUtils.round(-2 + Math.random() * 8, 2),
          breakevens: { upper: MathUtils.round(100 + mockMove * 1.5, 2), lower: MathUtils.round(100 - mockMove * 1.5, 2) },
          takeProfit1: { pct: 50, scale: 50 },
          takeProfit2: { pct: 75, scale: 100 },
          stopLoss: MathUtils.round(mockMove * 0.75, 2),
          maxHoldDays: 3,
        },
        priceTargets: {
          predictedOpen: MathUtils.round(100 + (Math.random() - 0.5) * 5, 2),
          predictedHigh: MathUtils.round(100 + mockMove, 2),
          predictedLow: MathUtils.round(100 - mockMove, 2),
          predictedClose: MathUtils.round(100 + (Math.random() - 0.5) * 3, 2),
          confidence: MathUtils.round(mockMove * 0.3, 2),
        },
        liquidity: { spreadPct: MathUtils.round(5 + Math.random() * 15, 1), status: 'PASS', openInterest: 500, volume: 200, recommendedMaxPosition: 10000 },
        edgeScore: MathUtils.round(35 + Math.random() * 50, 1),
      };
    });

    _results.sort((a, b) => b.edgeScore - a.edgeScore);
    _renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init, runAnalysis };
})();
