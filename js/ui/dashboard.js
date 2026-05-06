/**
 * Dashboard view — renders summary tables and top trades.
 */
const Dashboard = (() => {

  function render(results, earningsData) {
    _renderPriceMovers(earningsData.priorDay, results);
    _renderEarningsTable('earnings-today-content', earningsData.currentDay, results);
    _renderEarningsTable('earnings-tomorrow-content', earningsData.nextDay, results);
    _renderTopTrades(results);
    _updateSummaryStats(results, earningsData);
  }

  function _renderPriceMovers(priorDay, results) {
    const container = document.getElementById('price-movers-content');
    if (!container) return;

    const rows = priorDay.map(s => {
      const r = results.find(x => x.ticker === s.ticker);
      const price = r?.currentPrice || '--';
      const move = r?.historicalMoves?.directionalMoves?.[0];
      const moveStr = move != null ? `${move > 0 ? '+' : ''}${move}%` : '--';
      const cls = move > 0 ? 'positive' : move < 0 ? 'negative' : 'neutral';
      return `<tr>
        <td><strong>${s.ticker}</strong></td>
        <td>${s.time}</td>
        <td>$${price}</td>
        <td class="${cls}">${moveStr}</td>
        <td>${s.hasWhisper ? 'W' : '-'}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table class="data-table">
      <thead><tr><th>Ticker</th><th>Time</th><th>Price</th><th>Move</th><th>Whisper</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="neutral">No data</td></tr>'}</tbody>
    </table>`;
  }

  function _renderEarningsTable(containerId, stocks, results) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rows = stocks.map(s => {
      const r = results.find(x => x.ticker === s.ticker);
      const price = r?.currentPrice ? `$${r.currentPrice}` : '--';
      const im = r?.impliedMove?.impliedMovePct ? `${r.impliedMove.impliedMovePct}%` : '--';
      const ivClass = r?.ivRichness?.classification || '';
      const ivLabel = r?.ivRichness?.classificationLabel || '--';
      const edge = r?.edgeScore || '--';
      const strat = r?.recommendation?.strategy || '--';

      return `<tr>
        <td><strong>${s.ticker}</strong></td>
        <td><span class="tc-badge ${s.time.toLowerCase()}">${s.time}</span></td>
        <td>${price}</td>
        <td>${im}</td>
        <td><span class="iv-badge ${ivClass}">${ivLabel}</span></td>
        <td>${edge}</td>
        <td class="${strat.includes('Short') ? 'negative' : strat.includes('Long') ? 'positive' : ''}">${strat}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `<table class="data-table">
      <thead><tr><th>Ticker</th><th>Time</th><th>Price</th><th>Impl.Move</th><th>IV</th><th>Edge</th><th>Strategy</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="neutral">No data</td></tr>'}</tbody>
    </table>`;
  }

  function _renderTopTrades(results) {
    const container = document.getElementById('top-trades-content');
    if (!container) return;

    const top5 = results.slice(0, 5);
    container.innerHTML = top5.map(r => `
      <div class="top-trade-mini">
        <span class="top-trade-ticker">${r.ticker}</span>
        <span class="top-trade-strategy">${r.recommendation?.strategy || '--'}</span>
        <span class="top-trade-edge ${r.edgeScore > 65 ? 'positive' : r.edgeScore > 50 ? 'neutral' : 'negative'}">
          Edge: ${r.edgeScore}
        </span>
      </div>
    `).join('') || '<p class="neutral">Run analysis to see trades</p>';
  }

  function _updateSummaryStats(results, earningsData) {
    _setText('stat-total', earningsData.all.length);
    _setText('stat-optionable', results.length);
    _setText('stat-whisper', results.filter(r => r.hasWhisper).length);

    const avgIV = results.length
      ? MathUtils.round(MathUtils.mean(results.filter(r => r.ivRichness).map(r => r.ivRichness.ivPercentile)), 0)
      : '--';
    _setText('stat-avg-iv', avgIV !== '--' ? `${avgIV}th` : '--');

    const best = results[0];
    _setText('stat-best-edge', best ? `${best.ticker} (${best.edgeScore})` : '--');
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  return { render };
})();
