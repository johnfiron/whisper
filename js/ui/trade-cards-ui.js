/**
 * Trade Cards UI — renders detailed analysis cards for each stock.
 */
const TradeCardsUI = (() => {

  function render(results) {
    const container = document.getElementById('trade-cards-container');
    if (!container) return;
    container.innerHTML = results.map(r => _buildCard(r)).join('');
    _bindEvents();
  }

  function _buildCard(r) {
    const tierClass = `tier-${r.tier}`;
    const timeClass = (r.time || '').toLowerCase();

    return `
    <div class="trade-card ${tierClass}" data-ticker="${r.ticker}" data-tier="${r.tier}" data-edge="${r.edgeScore}">
      <div class="tc-header">
        <div>
          <span class="tc-ticker">${r.ticker}</span>
          <span class="tc-badge ${timeClass}">${r.time}</span>
          <span class="tc-badge tier">T${r.tier}</span>
        </div>
        <div class="tc-meta">
          <span class="tc-price">$${r.currentPrice}</span>
        </div>
      </div>
      <div class="tc-body">
        ${_sectionCatalyst(r)}
        ${_sectionImpliedMove(r)}
        ${_sectionVolatility(r)}
        ${r.ivCrush ? _sectionCrush(r) : ''}
        ${r.termStructure ? _sectionTermStructure(r) : ''}
        ${_sectionPriceTargets(r)}
        ${_sectionNews(r)}
        ${_sectionRecommendation(r)}
        <button class="tc-expand-btn" data-ticker="${r.ticker}">Show Details ▾</button>
        <div class="tc-details" id="details-${r.ticker}">
          ${_sectionGreeks(r)}
          ${_sectionBacktest(r)}
          ${_sectionLiquidity(r)}
          ${_sectionPositionMgmt(r)}
        </div>
      </div>
    </div>`;
  }

  function _sectionCatalyst(r) {
    const whisperLine = r.hasWhisper && r.whisperNumber != null
      ? `<div class="tc-row"><span class="tc-key">Whisper vs Est</span><span class="tc-val">${r.whisperNumber} vs ${r.epsEstimate} (${r.whisperNumber > r.epsEstimate ? '+' : ''}${MathUtils.round(((r.whisperNumber - r.epsEstimate) / Math.abs(r.epsEstimate)) * 100, 1)}%)</span></div>`
      : `<div class="tc-row"><span class="tc-key">Whisper</span><span class="tc-val neutral">None</span></div>`;

    return `<div class="tc-section">
      <div class="tc-section-title">Catalyst</div>
      <div class="tc-row"><span class="tc-key">Earnings</span><span class="tc-val">${r.date} ${r.time}</span></div>
      <div class="tc-row"><span class="tc-key">EPS Estimate</span><span class="tc-val">$${r.epsEstimate || '--'}</span></div>
      ${whisperLine}
      <div class="tc-row"><span class="tc-key">Sector</span><span class="tc-val">${r.sector || '--'}</span></div>
    </div>`;
  }

  function _sectionImpliedMove(r) {
    const im = r.impliedMove;
    if (!im) return '<div class="tc-section"><div class="tc-section-title">Implied Move</div><p class="neutral">N/A</p></div>';

    const hist = r.historicalMoves;
    return `<div class="tc-section">
      <div class="tc-section-title">Implied Move</div>
      <div class="tc-row"><span class="tc-key">Straddle (85%)</span><span class="tc-val">${im.impliedMovePct}% ($${im.impliedMoveDollar})</span></div>
      <div class="tc-row"><span class="tc-key">1-Std Dev (68%)</span><span class="tc-val">${im.stddevMovePct}%</span></div>
      <div class="tc-row"><span class="tc-key">Hist Avg (${hist?.count || 0}Q)</span><span class="tc-val">${hist?.avgMove || '--'}%</span></div>
      <div class="tc-row"><span class="tc-key">Range</span><span class="tc-val">$${im.lowerPrice} — $${im.upperPrice}</span></div>
    </div>`;
  }

  function _sectionVolatility(r) {
    const iv = r.ivRichness;
    if (!iv) return '';
    return `<div class="tc-section">
      <div class="tc-section-title">Volatility Analysis</div>
      <div class="tc-row"><span class="tc-key">ATM IV</span><span class="tc-val">${iv.currentIVPct}%</span></div>
      <div class="tc-row"><span class="tc-key">IV Percentile (1Y)</span><span class="tc-val">${iv.ivPercentile}th</span></div>
      <div class="tc-row"><span class="tc-key">IV Rank</span><span class="tc-val">${iv.ivRank}%</span></div>
      <div class="tc-row"><span class="tc-key">Classification</span><span class="tc-val"><span class="iv-badge ${iv.classification}">${iv.classificationLabel}</span></span></div>
    </div>`;
  }

  function _sectionCrush(r) {
    const c = r.ivCrush;
    return `<div class="tc-section">
      <div class="tc-section-title">IV Crush Forecast</div>
      <div class="tc-row"><span class="tc-key">Post-Earnings IV</span><span class="tc-val">${c.postEarningsIVPct}% (−${c.crushMagnitudePct}%)</span></div>
      <div class="tc-row"><span class="tc-key">Crush Magnitude</span><span class="tc-val">${c.crushPctOfIV}% of current IV</span></div>
      <div class="tc-row"><span class="tc-key">Normalization</span><span class="tc-val">${c.normalizationDays} days</span></div>
    </div>`;
  }

  function _sectionTermStructure(r) {
    const ts = r.termStructure;
    if (!ts || ts.structure === 'N/A') return '';
    return `<div class="tc-section">
      <div class="tc-section-title">Term Structure</div>
      <div class="tc-row"><span class="tc-key">Front IV</span><span class="tc-val">${ts.frontIVPct}% (${ts.frontExpiry})</span></div>
      <div class="tc-row"><span class="tc-key">Back IV</span><span class="tc-val">${ts.backIVPct}% (${ts.backExpiry})</span></div>
      <div class="tc-row"><span class="tc-key">Structure</span><span class="tc-val">${ts.structure} (${ts.slopePct}%)</span></div>
      <div class="tc-row"><span class="tc-key">Event Vol</span><span class="tc-val">${ts.eventVolPct}%</span></div>
    </div>`;
  }

  function _sectionPriceTargets(r) {
    const pt = r.priceTargets;
    if (!pt) return '';
    return `<div class="tc-section">
      <div class="tc-section-title">Price Targets (Multi-Model)</div>
      <div class="tc-row"><span class="tc-key">Predicted Open</span><span class="tc-val">$${pt.predictedOpen} (±$${pt.confidence})</span></div>
      <div class="tc-row"><span class="tc-key">Trading High</span><span class="tc-val positive">$${pt.predictedHigh}</span></div>
      <div class="tc-row"><span class="tc-key">Trading Low</span><span class="tc-val negative">$${pt.predictedLow}</span></div>
      <div class="tc-row"><span class="tc-key">Predicted Close</span><span class="tc-val">$${pt.predictedClose}</span></div>
    </div>`;
  }

  function _sectionNews(r) {
    const nt = r.newsTimeline;
    if (!nt || !nt.articles.length) {
      return `<div class="tc-section">
        <div class="tc-section-title">News Timeline</div>
        <p class="neutral" style="font-size:0.78rem">No news data (configure News API in Settings)</p>
      </div>`;
    }

    const top3 = nt.articles.slice(0, 3);
    const pricing = r.newsPricingIn;
    const contagion = r.peerContagion;

    return `<div class="tc-section">
      <div class="tc-section-title">News Timeline</div>
      <div class="tc-row"><span class="tc-key">Headlines (7d)</span><span class="tc-val">${nt.bullish}↑ ${nt.bearish}↓ ${nt.neutral}→</span></div>
      <div class="tc-row"><span class="tc-key">Avg Sentiment</span><span class="tc-val ${nt.avgSentiment > 0.1 ? 'positive' : nt.avgSentiment < -0.1 ? 'negative' : 'neutral'}">${nt.avgSentiment}</span></div>
      ${pricing ? `<div class="tc-row"><span class="tc-key">Priced In</span><span class="tc-val">${pricing.status}</span></div>` : ''}
      ${contagion?.isContagionCarrier ? `<div class="tc-row"><span class="tc-key">Contagion</span><span class="tc-val">Peers: ${contagion.peers.map(p => p.ticker).join(', ')}</span></div>` : ''}
      ${top3.map(a => `<div class="tc-news-item"><span class="tc-news-sentiment ${a.classification}">${a.classification}</span><span>${a.title?.substring(0, 60) || 'Untitled'}…</span></div>`).join('')}
    </div>`;
  }

  function _sectionRecommendation(r) {
    const rec = r.recommendation;
    if (!rec) return '';
    return `<div class="tc-section">
      <div class="tc-section-title">Recommendation</div>
      <div class="tc-recommendation">
        <div class="tc-strategy">${rec.strategy}</div>
        <div class="tc-rationale">${rec.rationale}</div>
        <div class="tc-row"><span class="tc-key">Entry</span><span class="tc-val">$${rec.entryLimit} debit/credit</span></div>
        <div class="tc-row"><span class="tc-key">Max Loss</span><span class="tc-val negative">$${rec.maxLoss}</span></div>
        <div class="tc-row"><span class="tc-key">Max Gain</span><span class="tc-val positive">$${rec.maxGain}</span></div>
        <div class="tc-row"><span class="tc-key">P(Profit)</span><span class="tc-val">${rec.profitProb}%</span></div>
        <div class="tc-row"><span class="tc-key">EV</span><span class="tc-val ${rec.expectedValue > 0 ? 'positive' : 'negative'}">$${rec.expectedValue}</span></div>
        <div class="tc-row"><span class="tc-key">Breakevens</span><span class="tc-val">$${rec.breakevens.lower} / $${rec.breakevens.upper}</span></div>
      </div>
      <div style="margin-top:0.4rem;font-size:0.78rem;color:var(--text-muted)">Alt: ${rec.secondary}</div>
    </div>`;
  }

  function _sectionGreeks(r) {
    if (!r.greeksCall && !r.greeksPut) return '';
    const g = r.greeksCall || r.greeksPut;
    return `<div class="tc-section">
      <div class="tc-section-title">Greeks (ATM)</div>
      <div class="tc-pos-grid">
        <div class="tc-row"><span class="tc-key">Delta</span><span class="tc-val">${g.delta}</span></div>
        <div class="tc-row"><span class="tc-key">Gamma</span><span class="tc-val">${g.gamma}</span></div>
        <div class="tc-row"><span class="tc-key">Theta</span><span class="tc-val">${g.theta}/day (${g.thetaPctOfPremium}%)</span></div>
        <div class="tc-row"><span class="tc-key">Vega</span><span class="tc-val">${g.vega} per 1%</span></div>
        <div class="tc-row"><span class="tc-key">Gamma Scalp</span><span class="tc-val">$${g.gammaScalpingPotential}</span></div>
      </div>
    </div>`;
  }

  function _sectionBacktest(r) {
    if (!r.backtest || !r.backtest.quarterCount) return '';
    const bt = r.backtest;
    return `<div class="tc-section">
      <div class="tc-section-title">Straddle Backtest (${bt.quarterCount}Q)</div>
      <div class="tc-row"><span class="tc-key">Avg Excess Return</span><span class="tc-val ${bt.avgExcessReturn > 0 ? 'positive' : 'negative'}">${bt.avgExcessReturn}%</span></div>
      <div class="tc-row"><span class="tc-key">Win Rate</span><span class="tc-val">${bt.winRate}%</span></div>
      <div class="tc-row"><span class="tc-key">Sharpe</span><span class="tc-val">${bt.sharpeRatio}</span></div>
      <div class="tc-row"><span class="tc-key">95% CI</span><span class="tc-val">[${bt.confidenceLower}, ${bt.confidenceUpper}]</span></div>
      <div class="tc-row"><span class="tc-key">Verdict</span><span class="tc-val">${bt.recommendation}</span></div>
    </div>`;
  }

  function _sectionLiquidity(r) {
    if (!r.liquidity) return '';
    const lq = r.liquidity;
    const cls = lq.status === 'PASS' ? 'liq-pass' : lq.status === 'WARNING' ? 'liq-warn' : 'liq-reject';
    return `<div class="tc-section">
      <div class="tc-section-title">Liquidity</div>
      <div class="tc-row"><span class="tc-key">Spread</span><span class="tc-val ${cls}">${lq.spreadPct}% (${lq.status})</span></div>
      <div class="tc-row"><span class="tc-key">Open Interest</span><span class="tc-val">${lq.openInterest}</span></div>
      <div class="tc-row"><span class="tc-key">Volume</span><span class="tc-val">${lq.volume}</span></div>
      <div class="tc-row"><span class="tc-key">Max Position</span><span class="tc-val">$${lq.recommendedMaxPosition}</span></div>
    </div>`;
  }

  function _sectionPositionMgmt(r) {
    const rec = r.recommendation;
    if (!rec) return '';
    return `<div class="tc-section">
      <div class="tc-section-title">Position Management</div>
      <div class="tc-pos-grid">
        <div class="tc-row"><span class="tc-key">TP1</span><span class="tc-val">${rec.takeProfit1.pct}% → Scale ${rec.takeProfit1.scale}%</span></div>
        <div class="tc-row"><span class="tc-key">TP2</span><span class="tc-val">${rec.takeProfit2.pct}% → Scale ${rec.takeProfit2.scale}%</span></div>
        <div class="tc-row"><span class="tc-key">Stop Loss</span><span class="tc-val">$${rec.stopLoss}</span></div>
        <div class="tc-row"><span class="tc-key">Max Hold</span><span class="tc-val">${rec.maxHoldDays} days</span></div>
      </div>
    </div>`;
  }

  function _bindEvents() {
    document.querySelectorAll('.tc-expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ticker = btn.dataset.ticker;
        const details = document.getElementById(`details-${ticker}`);
        if (details) {
          details.classList.toggle('expanded');
          btn.textContent = details.classList.contains('expanded') ? 'Hide Details ▴' : 'Show Details ▾';
        }
      });
    });
  }

  function applyFilters(results) {
    const tickerFilter = (document.getElementById('filter-ticker')?.value || '').toUpperCase();
    const tierFilter = document.getElementById('filter-tier')?.value || 'all';
    const sortBy = document.getElementById('sort-cards')?.value || 'edge';

    let filtered = [...results];
    if (tickerFilter) filtered = filtered.filter(r => r.ticker.includes(tickerFilter));
    if (tierFilter !== 'all') filtered = filtered.filter(r => r.tier === parseInt(tierFilter));

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'iv': return (b.ivRichness?.ivPercentile || 0) - (a.ivRichness?.ivPercentile || 0);
        case 'move': return (b.impliedMove?.impliedMovePct || 0) - (a.impliedMove?.impliedMovePct || 0);
        case 'mcap': return (b.marketCap || 0) - (a.marketCap || 0);
        default: return (b.edgeScore || 0) - (a.edgeScore || 0);
      }
    });

    render(filtered);
  }

  return { render, applyFilters };
})();
