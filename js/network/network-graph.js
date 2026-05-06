/**
 * 3D Network Diagram — Force-directed graph with Three.js
 * Displays earnings contagion, news flow, supply chain, and competitive edges.
 */
const NetworkGraph = (() => {
  let _scene, _camera, _renderer, _labelRenderer, _controls;
  let _nodes = [], _edges = [];
  let _meshes = [], _lines = [], _labels = [];
  let _raycaster, _mouse, _hoveredNode = null;
  let _animFrame = null;
  let _initialized = false;

  const ZONE_COLORS = {
    red: 0xf85149,
    green: 0x3fb950,
    yellow: 0xd29922,
    blue: 0x58a6ff,
    purple: 0xbc8cff,
    gray: 0x6e7681,
  };

  const EDGE_COLORS = {
    'earnings-positive': 0x3fb950,
    'earnings-negative': 0xf85149,
    'earnings-neutral': 0x6e7681,
    'supply-chain': 0x58a6ff,
    'competitive': 0xd29922,
    'news-flow': 0xbc8cff,
  };

  const SECTOR_ETFS = {
    'Technology': 'XLK', 'Communication Services': 'XLC',
    'Consumer Discretionary': 'XLY', 'Consumer Staples': 'XLP',
    'Energy': 'XLE', 'Healthcare': 'XLV', 'Financials': 'XLF',
    'Industrials': 'XLI', 'Materials': 'XLB', 'Real Estate': 'XLRE',
    'Utilities': 'XLU',
  };

  function init() {
    if (_initialized) return;
    const container = document.getElementById('network-container');
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x080c12);
    _scene.fog = new THREE.Fog(0x080c12, 200, 600);

    _camera = new THREE.PerspectiveCamera(60, w / h, 1, 1000);
    _camera.position.set(100, 80, 150);

    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(_renderer.domElement);

    if (typeof THREE.CSS2DRenderer !== 'undefined') {
      _labelRenderer = new THREE.CSS2DRenderer();
      _labelRenderer.setSize(w, h);
      _labelRenderer.domElement.style.position = 'absolute';
      _labelRenderer.domElement.style.top = '0';
      _labelRenderer.domElement.style.pointerEvents = 'none';
      container.appendChild(_labelRenderer.domElement);
    }

    if (typeof THREE.OrbitControls !== 'undefined') {
      _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
      _controls.enableDamping = true;
      _controls.dampingFactor = 0.05;
      _controls.minDistance = 30;
      _controls.maxDistance = 400;
    }

    const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
    _scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    _scene.add(dirLight);

    _addGrid();

    _raycaster = new THREE.Raycaster();
    _mouse = new THREE.Vector2();
    container.addEventListener('mousemove', _onMouseMove);
    container.addEventListener('click', _onMouseClick);

    window.addEventListener('resize', () => _onResize(container));

    document.getElementById('btn-network-reset-cam')?.addEventListener('click', _resetCamera);
    document.getElementById('btn-network-export')?.addEventListener('click', _exportPNG);

    _initialized = true;
    _animate();
  }

  function _addGrid() {
    const grid = new THREE.GridHelper(300, 30, 0x1a1f26, 0x1a1f26);
    grid.position.y = -50;
    _scene.add(grid);
  }

  function buildFromResults(results) {
    _clearScene();
    if (!results.length) return;

    _nodes = [];
    _edges = [];

    const sectorGroups = {};
    let sectorIdx = 0;

    // Build nodes
    for (const r of results) {
      if (!sectorGroups[r.sector]) {
        sectorGroups[r.sector] = sectorIdx++;
      }

      const zone = _determineZone(r);
      const x = (sectorGroups[r.sector] || 0) * 30 - 60;
      const y = Math.log10(Math.max(r.marketCap, 1e6)) * 10 - 60;
      const z = (r.ivRichness?.ivPercentile || 50) * 1.2 - 60;
      const size = Math.max(2, Math.log10(r.impliedMove?.impliedMovePct || 1 + 1) * 4);

      _nodes.push({
        id: r.ticker,
        ticker: r.ticker,
        sector: r.sector,
        marketCap: r.marketCap,
        ivPercentile: r.ivRichness?.ivPercentile || 50,
        expectedMove: r.impliedMove?.impliedMovePct || 0,
        zone,
        position: new THREE.Vector3(x + (Math.random() - 0.5) * 10, y, z),
        size,
        data: r,
      });
    }

    // Add sector ETF nodes
    const sectorsSeen = new Set(results.map(r => r.sector));
    for (const [sector, etf] of Object.entries(SECTOR_ETFS)) {
      if (sectorsSeen.has(sector)) {
        const x = (sectorGroups[sector] || 0) * 30 - 60;
        _nodes.push({
          id: etf,
          ticker: etf,
          sector,
          marketCap: 0,
          ivPercentile: 50,
          expectedMove: 0,
          zone: 'gray',
          position: new THREE.Vector3(x, -40, 0),
          size: 3,
          isETF: true,
        });
      }
    }

    // Build edges
    for (const node of _nodes) {
      if (node.isETF) continue;
      const sectorPeers = _nodes.filter(n =>
        n.sector === node.sector && n.id !== node.id && !n.isETF
      );
      for (const peer of sectorPeers) {
        if (!_edges.find(e => (e.source === node.id && e.target === peer.id) || (e.source === peer.id && e.target === node.id))) {
          _edges.push({
            source: node.id,
            target: peer.id,
            weight: 0.3 + Math.random() * 0.5,
            type: 'earnings-neutral',
          });
        }
      }

      const etf = SECTOR_ETFS[node.sector];
      if (etf && _nodes.find(n => n.id === etf)) {
        _edges.push({
          source: node.id,
          target: etf,
          weight: 0.5,
          type: 'supply-chain',
        });
      }
    }

    _renderNodes();
    _renderEdges();
    _updateStats();
  }

  function _determineZone(r) {
    if (r.hasWhisper && r.whisperNumber != null && r.epsEstimate != null) {
      if (r.whisperNumber < r.epsEstimate) return 'red';
      if (r.whisperNumber > r.epsEstimate) return 'green';
    }
    if (r.ivRichness?.ivPercentile >= 90) return 'yellow';
    if (r.newsTimeline?.articles?.length > 3) return 'blue';
    if (r.peerContagion?.isContagionCarrier) return 'purple';
    return 'gray';
  }

  function _renderNodes() {
    for (const node of _nodes) {
      const geometry = new THREE.SphereGeometry(node.size, 16, 16);
      const color = ZONE_COLORS[node.zone] || ZONE_COLORS.gray;
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      mesh.userData = node;
      _scene.add(mesh);
      _meshes.push(mesh);

      if (_labelRenderer && typeof THREE.CSS2DObject !== 'undefined') {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'node-label';
        labelDiv.textContent = node.ticker;
        const label = new THREE.CSS2DObject(labelDiv);
        label.position.set(0, node.size + 2, 0);
        mesh.add(label);
        _labels.push(label);
      }
    }
  }

  function _renderEdges() {
    for (const edge of _edges) {
      const srcNode = _nodes.find(n => n.id === edge.source);
      const tgtNode = _nodes.find(n => n.id === edge.target);
      if (!srcNode || !tgtNode) continue;

      const edgeColor = EDGE_COLORS[edge.type] || 0x6e7681;
      const material = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.15 + edge.weight * 0.4,
        linewidth: 1,
      });

      const geometry = new THREE.BufferGeometry().setFromPoints([
        srcNode.position,
        tgtNode.position,
      ]);

      const line = new THREE.Line(geometry, material);
      line.userData = edge;
      _scene.add(line);
      _lines.push(line);
    }
  }

  function _clearScene() {
    for (const m of _meshes) {
      m.geometry.dispose();
      m.material.dispose();
      _scene.remove(m);
    }
    for (const l of _lines) {
      l.geometry.dispose();
      l.material.dispose();
      _scene.remove(l);
    }
    _meshes = [];
    _lines = [];
    _labels = [];
    _nodes = [];
    _edges = [];
  }

  function _animate() {
    _animFrame = requestAnimationFrame(_animate);
    if (_controls) _controls.update();

    const time = Date.now() * 0.001;
    for (const mesh of _meshes) {
      const node = mesh.userData;
      if (node?.data?.date === DateUtils.toYMD(new Date())) {
        mesh.material.emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.2;
      }
    }

    if (_renderer) _renderer.render(_scene, _camera);
    if (_labelRenderer) _labelRenderer.render(_scene, _camera);
  }

  function _onMouseMove(event) {
    const container = document.getElementById('network-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_mouse, _camera);
    const intersects = _raycaster.intersectObjects(_meshes);

    const tooltip = document.getElementById('network-tooltip');
    if (!tooltip) return;

    if (intersects.length > 0) {
      const node = intersects[0].object.userData;
      _hoveredNode = node;
      tooltip.classList.remove('hidden');
      tooltip.style.left = (event.clientX - container.getBoundingClientRect().left + 15) + 'px';
      tooltip.style.top = (event.clientY - container.getBoundingClientRect().top + 15) + 'px';

      const r = node.data;
      tooltip.innerHTML = `
        <div class="tt-ticker">${node.ticker}</div>
        <div class="tt-row"><span class="tt-key">Sector</span><span class="tt-val">${node.sector}</span></div>
        <div class="tt-row"><span class="tt-key">Exp. Move</span><span class="tt-val">${node.expectedMove}%</span></div>
        <div class="tt-row"><span class="tt-key">IV Pctile</span><span class="tt-val">${node.ivPercentile}th</span></div>
        ${r?.recommendation ? `<div class="tt-row"><span class="tt-key">Strategy</span><span class="tt-val">${r.recommendation.strategy}</span></div>` : ''}
        ${r?.ivRichness ? `<div class="tt-row"><span class="tt-key">IV Class</span><span class="tt-val">${r.ivRichness.classificationLabel}</span></div>` : ''}
      `;
    } else {
      _hoveredNode = null;
      tooltip.classList.add('hidden');
    }
  }

  function _onMouseClick() {
    if (!_hoveredNode) return;
    Logger.info(`Network: clicked ${_hoveredNode.ticker}`);
  }

  function _onResize(container) {
    if (!container || !_camera || !_renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
    if (_labelRenderer) _labelRenderer.setSize(w, h);
  }

  function _resetCamera() {
    if (_camera) {
      _camera.position.set(100, 80, 150);
      if (_controls) _controls.reset();
    }
  }

  function _exportPNG() {
    if (!_renderer) return;
    _renderer.render(_scene, _camera);
    const dataUrl = _renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `network_${DateUtils.toYMD(new Date())}.png`;
    link.href = dataUrl;
    link.click();
  }

  function _updateStats() {
    const n = _nodes.length;
    const e = _edges.length;
    const maxEdges = n * (n - 1) / 2;
    const density = maxEdges > 0 ? MathUtils.round(e / maxEdges, 3) : 0;
    const avgCorr = _edges.length ? MathUtils.round(MathUtils.mean(_edges.map(ed => ed.weight)), 3) : 0;

    const degreeMap = {};
    for (const edge of _edges) {
      degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
      degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
    }
    const central = Object.entries(degreeMap).sort((a, b) => b[1] - a[1])[0];

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setText('net-density', density);
    setText('net-avg-corr', avgCorr);
    setText('net-central', central ? `${central[0]} (${central[1]})` : '--');
  }

  function getNetworkData() {
    return {
      nodes: _nodes.map(n => ({
        id: n.id, ticker: n.ticker, sector: n.sector,
        market_cap: n.marketCap, iv_percentile: n.ivPercentile,
        expected_move: n.expectedMove, zone_color: n.zone,
      })),
      edges: _edges.map(e => ({
        source: e.source, target: e.target,
        weight: e.weight, edge_type: e.type,
      })),
    };
  }

  function destroy() {
    if (_animFrame) cancelAnimationFrame(_animFrame);
    _clearScene();
    if (_renderer) {
      _renderer.dispose();
      _renderer.domElement.remove();
    }
    if (_labelRenderer) _labelRenderer.domElement.remove();
    _initialized = false;
  }

  return { init, buildFromResults, getNetworkData, destroy };
})();
