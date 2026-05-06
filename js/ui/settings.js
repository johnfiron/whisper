/**
 * Settings panel — manages API configuration UI.
 */
const Settings = (() => {

  function init() {
    const config = Config.load();

    _setVal('input-tradier-token', config.tradierToken);
    _setVal('input-tradier-env', config.tradierEnv);
    _setVal('input-news-provider', config.newsProvider);
    _setVal('input-news-token', config.newsToken);
    _setVal('input-auto-refresh', config.autoRefreshSec);
    _setChecked('input-exclude-illiquid', config.excludeIlliquid);
    _setChecked('input-use-whisper', config.useWhisper);

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      document.getElementById('settings-overlay')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      document.getElementById('settings-overlay')?.classList.add('hidden');
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      Config.save({
        tradierToken: _getVal('input-tradier-token'),
        tradierEnv: _getVal('input-tradier-env'),
        newsProvider: _getVal('input-news-provider'),
        newsToken: _getVal('input-news-token'),
        autoRefreshSec: parseInt(_getVal('input-auto-refresh')) || 300,
        excludeIlliquid: _getChecked('input-exclude-illiquid'),
        useWhisper: _getChecked('input-use-whisper'),
      });
      document.getElementById('settings-overlay')?.classList.add('hidden');
      Logger.success('Settings saved. Reloading analysis…');
      if (window.App?.runAnalysis) window.App.runAnalysis();
    });

    document.getElementById('settings-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'settings-overlay') {
        document.getElementById('settings-overlay')?.classList.add('hidden');
      }
    });
  }

  function _setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }
  function _getVal(id) {
    return document.getElementById(id)?.value ?? '';
  }
  function _setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }
  function _getChecked(id) {
    return document.getElementById(id)?.checked ?? false;
  }

  return { init };
})();
