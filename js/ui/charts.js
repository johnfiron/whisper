/**
 * Charts module — renders Chart.js visualizations for IV heatmap and sector correlation.
 */
const Charts = (() => {
  let _ivChart = null;
  let _corrChart = null;

  function renderIVHeatmap(results) {
    const canvas = document.getElementById('canvas-iv-heatmap');
    if (!canvas) return;

    const data = results
      .filter(r => r.ivRichness)
      .sort((a, b) => (b.ivRichness?.ivPercentile || 0) - (a.ivRichness?.ivPercentile || 0))
      .slice(0, 20);

    if (_ivChart) _ivChart.destroy();

    const colors = data.map(r => {
      const p = r.ivRichness.ivPercentile;
      if (p >= 90) return 'rgba(248,81,73,0.8)';
      if (p >= 70) return 'rgba(210,153,34,0.8)';
      if (p >= 30) return 'rgba(139,148,158,0.6)';
      if (p >= 10) return 'rgba(63,185,80,0.7)';
      return 'rgba(57,210,192,0.8)';
    });

    _ivChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(r => r.ticker),
        datasets: [{
          label: 'IV Percentile',
          data: data.map(r => r.ivRichness.ivPercentile),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.8', '1').replace('0.6', '1').replace('0.7', '1')),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const r = data[ctx.dataIndex];
                return `${r.ivRichness.ivPercentile}th pctile — ${r.ivRichness.classificationLabel}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(48,54,61,0.5)' },
            ticks: { color: '#8b949e' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#e6edf3', font: { family: "'SF Mono', monospace", size: 10 } },
          },
        },
      },
    });
  }

  function renderSectorCorrelation(results) {
    const canvas = document.getElementById('canvas-sector-corr');
    if (!canvas) return;

    const sectors = [...new Set(results.map(r => r.sector).filter(Boolean))];
    if (sectors.length < 2) return;

    const sectorData = {};
    for (const s of sectors) {
      const moves = results
        .filter(r => r.sector === s && r.impliedMove)
        .map(r => r.impliedMove.impliedMovePct);
      sectorData[s] = moves;
    }

    if (_corrChart) _corrChart.destroy();

    const datasets = sectors.slice(0, 6).map((s, i) => {
      const colors = [
        'rgba(88,166,255,0.7)', 'rgba(63,185,80,0.7)', 'rgba(248,81,73,0.7)',
        'rgba(210,153,34,0.7)', 'rgba(188,140,255,0.7)', 'rgba(57,210,192,0.7)',
      ];
      return {
        label: s,
        data: sectorData[s] || [],
        backgroundColor: colors[i % colors.length],
      };
    });

    _corrChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sectors.slice(0, 6).map(s => {
          const stocks = results.filter(r => r.sector === s);
          return `${s} (${stocks.length})`;
        }),
        datasets: [{
          label: 'Avg Implied Move %',
          data: sectors.slice(0, 6).map(s => {
            const moves = (sectorData[s] || []);
            return moves.length ? MathUtils.round(MathUtils.mean(moves), 1) : 0;
          }),
          backgroundColor: [
            'rgba(88,166,255,0.7)', 'rgba(63,185,80,0.7)', 'rgba(248,81,73,0.7)',
            'rgba(210,153,34,0.7)', 'rgba(188,140,255,0.7)', 'rgba(57,210,192,0.7)',
          ],
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(48,54,61,0.5)' },
            ticks: { color: '#8b949e', callback: v => v + '%' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#e6edf3', font: { size: 9 }, maxRotation: 45 },
          },
        },
      },
    });
  }

  return { renderIVHeatmap, renderSectorCorrelation };
})();
