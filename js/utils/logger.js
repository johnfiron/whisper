/**
 * Pipeline logger — writes to both console and the in-app log panel.
 */
const Logger = (() => {
  const _entries = [];
  let _panel = null;

  function _getPanel() {
    if (!_panel) _panel = document.getElementById('pipeline-log');
    return _panel;
  }

  function _ts() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  function _append(level, msg) {
    const entry = { time: _ts(), level, msg };
    _entries.push(entry);
    const panel = _getPanel();
    if (panel) {
      const div = document.createElement('div');
      div.className = `log-entry log-${level}`;
      div.textContent = `[${entry.time}] [${level.toUpperCase()}] ${msg}`;
      panel.appendChild(div);
      panel.scrollTop = panel.scrollHeight;
    }
    if (level === 'error') console.error(`[EE] ${msg}`);
    else if (level === 'warn') console.warn(`[EE] ${msg}`);
    else console.log(`[EE] ${msg}`);
  }

  return {
    info: (msg) => _append('info', msg),
    warn: (msg) => _append('warn', msg),
    error: (msg) => _append('error', msg),
    success: (msg) => _append('success', msg),
    dim: (msg) => _append('dim', msg),
    entries: () => [..._entries],
    clear() {
      _entries.length = 0;
      const panel = _getPanel();
      if (panel) panel.innerHTML = '';
    },
  };
})();
