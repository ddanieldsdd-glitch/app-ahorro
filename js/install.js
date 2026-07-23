const APP_BUILD_ID = 'presupuesto-v59';
const WINDOWS_EXE_URL = 'https://github.com/ddanieldsdd-glitch/app-ahorro/releases/download/v2.0.4/Presupuesto.Personal.Setup.2.0.4.exe';
const PWA_INSTALLED_KEY = 'ahorro_pwa_installed';

const Install = {
  _deferredPrompt: null,
  _isStandalone: false,
  _isElectronApp: false,
  _swRegistration: null,
  _updateInfo: { running: '', jsVersion: '', remote: '', lastCheck: 0, checking: false, updateAvailable: false, integrityMismatch: false },
  _updateUiCallbacks: [],

  onUpdateStatusChange(cb) { this._updateUiCallbacks.push(cb); },

  _emitUpdateStatus() {
    this._updateUiCallbacks.forEach(cb => { try { cb(this.getUpdateInfo()); } catch { /* ignore */ } });
    this._refreshUpdateUI();
  },

  getUpdateInfo() {
    const html = this._getHtmlVersion();
    const js = this._getJsVersion();
    const mismatch = html && js && html !== js;
    return {
      ...this._updateInfo,
      htmlVersion: html,
      jsVersion: js,
      integrityMismatch: mismatch,
      installKind: this.getInstallKind(),
      installLabel: this.getInstallLabel(),
    };
  },

  _getHtmlVersion() {
    return window.__APP_BUILD_VERSION || this._getMetaVersion() || '';
  },

  _getJsVersion() {
    if (typeof APP_BUILD_ID !== 'undefined' && APP_BUILD_ID) return APP_BUILD_ID;
    return '';
  },

  _checkIntegrity() {
    const html = this._getHtmlVersion();
    const js = this._getJsVersion();
    if (!html || !js) return false;
    const mismatch = html !== js;
    this._updateInfo.integrityMismatch = mismatch;
    this._updateInfo.jsVersion = js;
    if (mismatch) {
      this._updateInfo.updateAvailable = true;
      const newer = this._pickNewestVersion([html, js]);
      if (newer && this._isBuildNewer(newer, this._getRunningVersion())) {
        window.__PENDING_APP_VERSION = this._pickNewestVersion([window.__PENDING_APP_VERSION, newer]);
      }
    }
    return mismatch;
  },

  async _cleanupLegacyServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(async (reg) => {
        const url = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
        if (url.includes('/sw.js?')) await reg.unregister();
      }));
    } catch { /* ignore */ }
  },

  init() {
    this._refreshInstallState();
    this._cleanupLegacyServiceWorkers();

    const justUpdated = sessionStorage.getItem('_appUpdateReload');
    if (justUpdated) {
      sessionStorage.removeItem('_appUpdateReload');
      const running = this._getRunningVersion();
      if (running) this._setLocalVersion(running);
      delete window.__PENDING_APP_VERSION;
    } else if (window.__PENDING_APP_VERSION) {
      const pending = window.__PENDING_APP_VERSION;
      const running = this._getHtmlVersion();
      if (this._isApplePlatform() && this.isInstalled() && this._isBuildNewer(pending, running)) {
        setTimeout(() => this._showAppleUpdateModal(pending, running), 400);
      } else {
        setTimeout(() => this._showUpdateBanner('version'), 300);
      }
    }

    this._checkIntegrity();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this._showBanner();
    });

    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      this._hideBanner();
      localStorage.setItem(PWA_INSTALLED_KEY, '1');
      this._refreshInstallState();
      if (typeof VercelAnalytics !== 'undefined') VercelAnalytics.track('app_installed');
      if (typeof App !== 'undefined') App.showToast('✅ App instalada correctamente');
    });

    if (!this.isInstalled() && !this._deferredPrompt) {
      const dismissed = sessionStorage.getItem('installBannerDismissed');
      if (!dismissed && this._isMobile()) this._showIosHint();
    }

    this._updateSyncBadge();
    if (typeof Store !== 'undefined') {
      Store.onSyncStatusChange(() => this._updateSyncBadge());
    }

    this._setupUpdateDetection();
    this._fetchRemoteVersion().then((v) => {
      if (v && !localStorage.getItem('_appCacheVersion')) {
        this._setLocalVersion(this._getRunningVersion() || v);
      }
      this._checkIntegrity();
      this._updateInfo.running = this._getRunningVersion();
      this._updateInfo.jsVersion = this._getJsVersion();
      if (v) this._updateInfo.remote = v;
      if (window.__PENDING_APP_VERSION || this._updateInfo.integrityMismatch) {
        this._updateInfo.updateAvailable = true;
      }
      this._emitUpdateStatus();
    });
  },

  _showAppleUpdateModal(pending, running) {
    if (document.getElementById('appleUpdateModal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'appleUpdateModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--card);border-radius:14px;padding:22px;max-width:340px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.25)">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px">🔄 Actualización disponible</div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.55;margin-bottom:14px">
          Hay una versión nueva en el servidor (<strong>${esc(pending)}</strong>).
          Tienes <strong>${esc(running || '—')}</strong> en este dispositivo.
          Pulsa actualizar para descargar la versión más reciente. Tus datos se conservan.
        </p>
        <button class="btn btn-primary" style="width:100%;margin-bottom:8px" id="appleUpdateNowBtn">⬆ Actualizar ahora</button>
        <button class="btn btn-secondary" style="width:100%" id="appleUpdateLaterBtn">Más tarde</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('appleUpdateNowBtn').addEventListener('click', () => {
      overlay.remove();
      this.forceUpdateNow(true);
    });
    document.getElementById('appleUpdateLaterBtn').addEventListener('click', () => {
      overlay.remove();
      this._showUpdateBanner('version');
    });
  },

  // ── Install detection ─────────────────────────────────────────────────────

  _inInstalledDisplayMode() {
    const modes = ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'];
    if (modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)) return true;
    // Cualquier modo distinto de "browser" suele ser ventana de app instalada (macOS PWA, etc.)
    try {
      return window.matchMedia('(display-mode: browser)').matches === false;
    } catch {
      return false;
    }
  },

  _refreshInstallState() {
    this._isElectronApp = this._detectElectron();
    const persistedPwa = localStorage.getItem(PWA_INSTALLED_KEY) === '1';
    this._isStandalone =
      this._inInstalledDisplayMode() ||
      window.navigator.standalone === true ||
      (persistedPwa && this._inInstalledDisplayMode());
    // Si el usuario marcó instalación pero abrió en pestaña del navegador, no contar como PWA
    if (persistedPwa && !this._isElectronApp && window.matchMedia('(display-mode: browser)').matches) {
      this._isStandalone = false;
    }
    if (this._isElectronApp) this._isStandalone = false;
  },

  _detectElectron() {
    if (window.AhorroInstall?.isDesktop) return true;
    if (window.CapacitorCustomPlatform?.name === 'electron') return true;
    if (/Electron/i.test(navigator.userAgent)) return true;
    try {
      const proto = window.location?.protocol || '';
      if (/^capacitor-electron:/i.test(proto)) return true;
    } catch { /* ignore */ }
    return false;
  },

  _desktopPlatform() {
    if (window.AhorroInstall?.platform) return window.AhorroInstall.platform;
    if (this._isMac()) return 'darwin';
    if (this._isWindows()) return 'win32';
    return '';
  },

  // ── Update detection ──────────────────────────────────────────────────────

  _isSafari() {
    return /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|Edg/i.test(navigator.userAgent);
  },

  _isApplePlatform() {
    return this._isIos() || this._isMac() || this._isSafari();
  },

  _fetchOpts() {
    return {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'X-App-Update-Check': '1',
      },
    };
  },

  _versionBust() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  },

  _parseBuildVersion(v) {
    if (!v) return 0;
    const m = String(v).match(/v(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  },

  _isBuildNewer(remote, running) {
    if (!remote) return false;
    if (!running) return true;
    const dr = this._parseBuildVersion(remote);
    const lr = this._parseBuildVersion(running);
    if (dr && lr) return dr > lr;
    return remote !== running;
  },

  _pickNewestVersion(candidates) {
    const unique = [...new Set((candidates || []).filter(Boolean))];
    if (!unique.length) return null;
    unique.sort((a, b) => this._parseBuildVersion(b) - this._parseBuildVersion(a));
    return unique[0];
  },

  _xhrText(url) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        xhr.setRequestHeader('Pragma', 'no-cache');
        xhr.setRequestHeader('X-App-Update-Check', '1');
        xhr.onload = () => resolve(xhr.responseText || '');
        xhr.onerror = () => reject(new Error('xhr failed'));
        xhr.send();
      } catch (e) {
        reject(e);
      }
    });
  },

  async _bypassCacheFetch(url) {
    const bust = this._versionBust();
    const full = `${url}${url.includes('?') ? '&' : '?'}_=${encodeURIComponent(bust)}`;
    const wrap = (text) => ({
      ok: true,
      text: async () => text,
      json: async () => JSON.parse(text),
    });
    if (this._isApplePlatform()) {
      try {
        const text = await this._xhrText(full);
        if (text) return wrap(text);
      } catch { /* fetch fallback */ }
    }
    const opts = this._fetchOpts();
    try {
      const res = await fetch(full, opts);
      if (res.ok) return res;
    } catch { /* ignore */ }
    if (!this._isApplePlatform()) {
      try {
        const text = await this._xhrText(full);
        if (text) return wrap(text);
      } catch { /* ignore */ }
    }
    return { ok: false, text: async () => '', json: async () => null };
  },

  _setupUpdateDetection() {
    const installed = this.isInstalled();
    const pollMs = this._isApplePlatform()
      ? (installed ? 15 * 1000 : 30 * 1000)
      : (installed ? 2 * 60 * 1000 : 5 * 60 * 1000);

    if (!('serviceWorker' in navigator)) {
      this._checkRemoteVersion(false);
      this._bindUpdateListeners();
      setInterval(() => this._onAppForeground(), pollMs);
      this._setupHeaderUpdateButton();
      return;
    }

    navigator.serviceWorker.ready.then(reg => {
      this._swRegistration = reg;
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this._showUpdateBanner('sw');
          }
        });
      });
      reg.update().catch(() => {});
      if (reg.waiting) this._showUpdateBanner('sw');
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('_appUpdateReload')) return;
      if (!refreshing) {
        refreshing = true;
        if (typeof Store !== 'undefined' && Store._hasSubstantialData?.(Store.getData())) {
          Store._backup?.('pre-sw-auto-reload');
        }
        window.location.reload();
      }
    });

    this._checkRemoteVersion(false);
    this._bindUpdateListeners();
    setInterval(() => this._onAppForeground(), pollMs);
    this._setupHeaderUpdateButton();
  },

  _setupHeaderUpdateButton() {
    const btn = document.getElementById('appUpdateBtn');
    if (!btn) return;
    const show = this._isMobile() || this._isMac() || this.isInstalled();
    btn.style.display = show ? '' : 'none';
    this._refreshUpdateUI();
  },

  _refreshUpdateUI() {
    const btn = document.getElementById('appUpdateBtn');
    if (btn) {
      btn.classList.toggle('has-update', !!this._updateInfo.updateAvailable);
      btn.title = this._updateInfo.updateAvailable
        ? `Actualización disponible (${this._updateInfo.remote})`
        : `App ${this._updateInfo.running || '—'} · Comprobar actualizaciones`;
    }
    const panelRunning = document.getElementById('updatePanelRunning');
    const panelJs = document.getElementById('updatePanelJs');
    const panelRemote = document.getElementById('updatePanelRemote');
    const panelIntegrity = document.getElementById('updatePanelIntegrity');
    const panelStatus = document.getElementById('updatePanelStatus');
    const panelLast = document.getElementById('updatePanelLastCheck');
    const htmlV = this._getHtmlVersion();
    const jsV = this._getJsVersion();
    if (panelRunning) panelRunning.textContent = htmlV || this._updateInfo.running || '—';
    if (panelJs) panelJs.textContent = jsV || '—';
    if (panelRemote) panelRemote.textContent = this._updateInfo.remote || '—';
    if (panelIntegrity) {
      const mismatch = htmlV && jsV && htmlV !== jsV;
      panelIntegrity.textContent = mismatch ? `⚠️ HTML (${htmlV}) ≠ JS (${jsV})` : '✓ Coherente';
      panelIntegrity.style.color = mismatch ? 'var(--expense)' : 'var(--income)';
    }
    if (panelLast) {
      panelLast.textContent = this._updateInfo.lastCheck
        ? new Date(this._updateInfo.lastCheck).toLocaleString('es-ES')
        : 'Aún no';
    }
    if (panelStatus) {
      if (this._updateInfo.checking) {
        panelStatus.textContent = 'Comprobando…';
        panelStatus.className = 'update-panel-status checking';
      } else if (this._updateInfo.updateAvailable) {
        panelStatus.textContent = this._updateInfo.integrityMismatch
          ? 'Actualización incompleta — recarga necesaria'
          : `Nueva versión: ${this._updateInfo.remote}`;
        panelStatus.className = 'update-panel-status available';
      } else if (this._updateInfo.remote) {
        panelStatus.textContent = 'App al día';
        panelStatus.className = 'update-panel-status ok';
      } else {
        panelStatus.textContent = 'Sin conexión — reintenta';
        panelStatus.className = 'update-panel-status offline';
      }
    }
    const forceBtn = document.getElementById('updatePanelForceBtn');
    if (forceBtn) forceBtn.style.display = (this._updateInfo.updateAvailable || this._updateInfo.integrityMismatch) ? '' : 'none';

    const settingsEl = document.getElementById('settingsUpdateStatus');
    if (settingsEl) {
      const info = this._updateInfo;
      const status = info.updateAvailable
        ? `<span style="color:var(--expense);font-weight:600">Nueva versión disponible: ${esc(info.remote || '?')}</span>`
        : info.remote
          ? '<span style="color:var(--income);font-weight:600">App al día</span>'
          : '<span style="color:var(--text-secondary)">Sin conexión — reintenta</span>';
      settingsEl.innerHTML = `<div>${status}</div>
        <div style="color:var(--text-secondary);font-size:11px;margin-top:4px">
          Instalada: <code>${esc(info.running || '—')}</code>
          · Servidor: <code>${esc(info.remote || '—')}</code>
          ${info.lastCheck ? `<br>Última comprobación: ${new Date(info.lastCheck).toLocaleString('es-ES')}` : ''}
        </div>`;
    }
  },

  _isBannerDismissed() {
    const raw = sessionStorage.getItem('updateBannerDismissedAt');
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (!t || Date.now() - t > 60 * 60 * 1000) {
      sessionStorage.removeItem('updateBannerDismissedAt');
      return false;
    }
    return true;
  },

  _bindUpdateListeners() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._onAppForeground();
    });
    window.addEventListener('pageshow', (e) => {
      this._onAppForeground();
      if (e.persisted && this._isApplePlatform()) this._checkRemoteVersion(false);
    });
    window.addEventListener('focus', () => this._onAppForeground());
    window.addEventListener('online', () => this._onAppForeground());
  },

  _onAppForeground() {
    this._checkRemoteVersion(false);
    if (this._swRegistration) this._swRegistration.update().catch(() => {});
    else if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) { this._swRegistration = reg; reg.update().catch(() => {}); }
      });
    }
  },

  async _fetchRemoteVersion() {
    const origin = window.location.origin;

    const tasks = [
      (async () => {
        try {
          const res = await this._bypassCacheFetch(`${origin}/api/version`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.cache || null;
        } catch { return null; }
      })(),
      (async () => {
        try {
          const res = await this._bypassCacheFetch(`${origin}/build-id.txt`);
          if (!res.ok) return null;
          const text = (await res.text()).trim();
          return text ? text.split(/\s+/)[0] : null;
        } catch { return null; }
      })(),
      (async () => {
        try {
          const res = await this._bypassCacheFetch(`${origin}/version-check.json`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.cache || data?.version || null;
        } catch { return null; }
      })(),
      (async () => {
        try {
          const res = await this._bypassCacheFetch(`${origin}/version.json`);
          if (!res.ok) return null;
          const data = await res.json();
          return data?.cache || data?.version || null;
        } catch { return null; }
      })(),
      this._fetchVersionFromIndexHtml(),
    ];

    const remote = this._pickNewestVersion(await Promise.all(tasks));
    return remote || null;
  },

  async _fetchVersionFromIndexHtml() {
    try {
      const res = await this._bypassCacheFetch(`${window.location.origin}/index.html`);
      if (!res.ok) return null;
      const html = await res.text();
      const meta = html.match(/name="app-cache-version"\s+content="([^"]+)"/i);
      if (meta?.[1]) return meta[1];
      const inline = html.match(/__APP_BUILD_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (inline?.[1]) return inline[1];
    } catch { /* ignore */ }
    return null;
  },

  async _fetchNetworkBuildId() {
    const remote = await this._fetchRemoteVersion();
    if (remote) return remote;

    const origin = window.location.origin;
    try {
      const res = await this._bypassCacheFetch(`${origin}/js/install.js`);
      if (res.ok) {
        const text = await res.text();
        const m = text.match(/APP_BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
        if (m?.[1]) return m[1];
      }
    } catch { /* ignore */ }
    return null;
  },

  _getMetaVersion() {
    const meta = document.querySelector('meta[name="app-cache-version"]');
    return meta?.content || window.__APP_CACHE_VERSION || '';
  },

  /** Versión del código JS que está ejecutándose (fiable en macOS con caché parcial). */
  _getRunningVersion() {
    const html = this._getHtmlVersion();
    const js = this._getJsVersion();
    if (html && js && html !== js) return js;
    if (html) return html;
    if (js) return js;
    return this._getLocalVersion() || '';
  },

  async _needsVersionUpdate(remote) {
    const running = this._getRunningVersion();
    const pending = window.__PENDING_APP_VERSION;
    const networkBuild = remote ? null : await this._fetchNetworkBuildId();
    const indexVersion = remote ? null : await this._fetchVersionFromIndexHtml();
    const remotes = this._pickNewestVersion([remote, pending, networkBuild, indexVersion]);

    if (!running) return !!remotes;
    return remotes ? this._isBuildNewer(remotes, running) : false;
  },

  _getLocalVersion() {
    return localStorage.getItem('_appCacheVersion') || this._getRunningVersion() || '';
  },

  _setLocalVersion(v) {
    if (v) localStorage.setItem('_appCacheVersion', v);
  },

  async _checkRemoteVersion(showIfCurrent) {
    this._updateInfo.checking = true;
    this._updateInfo.running = this._getRunningVersion();
    this._emitUpdateStatus();

    const remote = await this._fetchRemoteVersion();
    this._updateInfo.remote = remote || this._updateInfo.remote || '';
    this._updateInfo.lastCheck = Date.now();
    this._updateInfo.checking = false;

    if (!remote) {
      this._emitUpdateStatus();
      return false;
    }

    const needsUpdate = await this._needsVersionUpdate(remote);
    this._checkIntegrity();
    const integrityFail = this._updateInfo.integrityMismatch;
    this._updateInfo.updateAvailable = needsUpdate || integrityFail;
    this._updateInfo.jsVersion = this._getJsVersion();
    this._emitUpdateStatus();

    if (needsUpdate || integrityFail) {
      if (!this._isBannerDismissed()) this._showUpdateBanner(integrityFail ? 'integrity' : 'version');
      return true;
    }

    const running = this._getRunningVersion() || remote;
    this._setLocalVersion(running);
    this._updateInfo.running = running;
    this._updateInfo.updateAvailable = false;
    const banner = document.getElementById('updateBanner');
    if (banner) banner.remove();
    delete window.__PENDING_APP_VERSION;
    this._emitUpdateStatus();
    if (showIfCurrent && typeof App !== 'undefined') {
      App.showToast(`✅ App al día (${running})`);
    }
    return false;
  },

  async _checkServiceWorkerUpdate() {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    try { await reg.update(); } catch { /* ignore */ }
    if (reg.waiting) return true;
    if (reg.installing) {
      await new Promise((resolve) => {
        const w = reg.installing;
        const finish = () => resolve();
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) finish();
          if (w.state === 'activated' || w.state === 'redundant') finish();
        });
        setTimeout(finish, 4000);
      });
      if (reg.waiting) return true;
    }
    return false;
  },

  async checkOnStartup() {
    if (typeof Store !== 'undefined') Store.maybeBackupAfterUpdate?.();
    await this._checkServiceWorkerUpdate();
    await this._checkRemoteVersion(false);
  },

  async manualCheckForUpdates() {
    if (typeof App !== 'undefined') App.showToast('🔍 Comprobando actualizaciones…', 2000);
    this._updateInfo.checking = true;
    this._emitUpdateStatus();

    if (this._swRegistration) {
      try { await this._swRegistration.update(); } catch { /* ignore */ }
    } else if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) { this._swRegistration = reg; await reg.update(); }
      } catch { /* ignore */ }
    }

    await this._checkServiceWorkerUpdate();
    const hadUpdate = await this._checkRemoteVersion(true);
    const swUpdate = !!(this._swRegistration?.waiting);

    if (swUpdate && !hadUpdate) {
      this._updateInfo.updateAvailable = true;
      if (!this._isBannerDismissed()) this._showUpdateBanner('sw');
    }

    if (this._updateInfo.updateAvailable || swUpdate || window.__PENDING_APP_VERSION) {
      if (typeof App !== 'undefined') {
        const running = this._getRunningVersion();
        const newest = this._pickNewestVersion([this._updateInfo.remote, window.__PENDING_APP_VERSION, running]);
        const msg = newest && running && this._isBuildNewer(newest, running)
          ? `🔄 Nueva versión: ${newest} (tienes ${running})`
          : '🔄 Hay una actualización disponible';
        App.showToast(msg, 4500);
      }
    } else if (typeof App !== 'undefined') {
      const label = this._updateInfo.remote || this._updateInfo.running || 'desconocida';
      if (this._isApplePlatform()) {
        App.showToast(`✅ App al día (${label}). Si no ves cambios, usa «Forzar actualización».`, 5500);
      } else {
        App.showToast(`✅ App al día (${label})`);
      }
    }
    this.openUpdatePanel();
  },

  openUpdatePanel() {
    const info = this.getUpdateInfo();
    const isApple = this._isApplePlatform();
    const body = `
      <div class="update-panel-grid">
        <div class="update-panel-row"><span>HTML cargado</span><code id="updatePanelRunning">${esc(info.htmlVersion || info.running || '—')}</code></div>
        <div class="update-panel-row"><span>Código JS</span><code id="updatePanelJs">${esc(info.jsVersion || '—')}</code></div>
        <div class="update-panel-row"><span>En el servidor</span><code id="updatePanelRemote">${esc(info.remote || '—')}</code></div>
        <div class="update-panel-row"><span>Integridad</span><span id="updatePanelIntegrity" style="font-size:12px;font-weight:600;color:${info.integrityMismatch ? 'var(--expense)' : 'var(--income)'}">${info.integrityMismatch ? `⚠️ HTML (${esc(info.htmlVersion)}) ≠ JS (${esc(info.jsVersion)})` : '✓ Coherente'}</span></div>
        <div class="update-panel-row"><span>Última comprobación</span><span id="updatePanelLastCheck">${info.lastCheck ? new Date(info.lastCheck).toLocaleString('es-ES') : 'Aún no'}</span></div>
        <div class="update-panel-row"><span>Estado</span><span id="updatePanelStatus" class="update-panel-status ${info.checking ? 'checking' : info.updateAvailable ? 'available' : info.remote ? 'ok' : 'offline'}">${info.checking ? 'Comprobando…' : info.updateAvailable ? (info.integrityMismatch ? 'Actualización incompleta' : `Nueva versión: ${esc(info.remote)}`) : info.remote ? 'App al día' : 'Sin conexión'}</span></div>
        <div class="update-panel-row"><span>Modo</span><span>${esc(info.installLabel)}</span></div>
      </div>
      ${isApple ? `<div style="font-size:11px;color:var(--text-secondary);line-height:1.55;margin:12px 0;padding:10px;background:var(--bg);border-radius:8px">
        <strong>iPhone / iPad / Mac (Safari):</strong> la app instalada puede quedarse con caché antigua.
        Si hay versión nueva, pulsa <strong>Actualizar ahora</strong>. Si no basta, usa <strong>Forzar actualización</strong>
        o cierra la app por completo (quitar del multitarea) y ábrela de nuevo.
      </div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <button class="btn btn-secondary btn-sm" style="width:100%" onclick="Install.manualCheckForUpdates()">🔍 Comprobar de nuevo</button>
        <button class="btn btn-primary btn-sm" id="updatePanelForceBtn" style="width:100%;${info.updateAvailable ? '' : 'display:none'}" onclick="Install.forceUpdateNow()">⬆ Actualizar ahora</button>
        <button class="btn btn-secondary btn-sm" style="width:100%" onclick="Install.forceUpdateNow(true)">🔄 Forzar actualización (limpiar caché)</button>
      </div>`;

    if (typeof App !== 'undefined') {
      App.openModal({
        title: '🔄 Actualizaciones',
        body,
        actions: [{ label: 'Cerrar' }],
      });
    }
    this._refreshUpdateUI();
  },

  async forceUpdateNow(hard = false) {
    const doHard = hard || this._isApplePlatform() || this._updateInfo.integrityMismatch;
    if (typeof App !== 'undefined') {
      App.showToast(doHard ? '🔄 Limpiando caché y recargando…' : '⬆ Actualizando…', 2500);
    }
    if (typeof Store !== 'undefined') {
      Store._backup?.('pre-update-reload');
      try {
        const prefs = typeof StoragePrefs !== 'undefined' ? StoragePrefs.getPrefs() : {};
        if (prefs.autoBackupToFolder && Store.exportJSON) {
          const stamp = new Date().toISOString().split('T')[0];
          await StoragePrefs.mirrorBackupToFolder(Store.exportJSON(), `presupuesto_pre_update_${stamp}.json`);
        }
      } catch { /* ignore */ }
    }
    let remote = null;
    try {
      remote = await this._fetchRemoteVersion();
      if (remote) sessionStorage.setItem('_appUpdateReload', remote);
      delete window.__PENDING_APP_VERSION;
    } catch { /* ignore */ }
    try { localStorage.removeItem('_appCacheVersion'); } catch { /* ignore */ }

    const reg = this._swRegistration || (navigator.serviceWorker?.getRegistration
      ? await navigator.serviceWorker.getRegistration()
      : null);
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else if (reg?.installing) reg.installing.postMessage({ type: 'SKIP_WAITING' });

    if (doHard) {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch { /* ignore */ }
      await new Promise((resolve) => {
        let n = 0;
        const tick = () => {
          if (!navigator.serviceWorker?.controller || n >= 12) resolve();
          else { n++; setTimeout(tick, 250); }
        };
        tick();
      });
    }

    const bust = Date.now();
    const hardParam = doHard ? '&hard=1' : '';
    window.location.replace(`${window.location.origin}/index.html?_=${bust}${remote ? '&v=' + encodeURIComponent(remote) : ''}${hardParam}`);
  },

  _showUpdateBanner(source) {
    this._updateInfo.updateAvailable = true;
    this._emitUpdateStatus();
    if (document.getElementById('updateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    const isApple = this._isApplePlatform();
    banner.innerHTML = `
      <div class="update-banner-text">
        <strong>🔄 Actualización disponible</strong>
        <span>Nueva versión — tus movimientos y saldos se conservan al actualizar${isApple ? ' · En iPhone/Mac pulsa Actualizar' : ''}</span>
      </div>
      <div class="update-banner-actions">
        <button class="btn btn-primary btn-sm" id="updateBannerBtn">Actualizar ahora</button>
        <button class="btn btn-secondary btn-sm" id="updateBannerDismiss">Luego</button>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('updateBannerBtn').addEventListener('click', () => this.forceUpdateNow(true));
    document.getElementById('updateBannerDismiss').addEventListener('click', () => {
      sessionStorage.setItem('updateBannerDismissedAt', String(Date.now()));
      banner.remove();
    });
  },

  // ─────────────────────────────────────────────────────────────────────────

  _isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  _isIos() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  },

  _isAndroid() {
    return /Android/i.test(navigator.userAgent);
  },

  _isWindows() {
    return /Windows/i.test(navigator.userAgent) || /Win/i.test(navigator.platform);
  },

  _isMac() {
    const p = navigator.platform || '';
    const ua = navigator.userAgent || '';
    return /Mac/i.test(p) || /Mac OS X/i.test(ua);
  },

  _isElectron() {
    this._refreshInstallState();
    return this._isElectronApp;
  },

  getInstallKind() {
    this._refreshInstallState();
    if (this._isElectronApp) {
      const plat = this._desktopPlatform();
      if (plat === 'darwin' || this._isMac()) return 'electron-macos';
      if (plat === 'win32' || this._isWindows()) return 'electron-windows';
      return 'electron';
    }
    if (this.isInstalled()) {
      if (this._isIos()) return 'pwa-ios';
      if (this._isAndroid()) return 'pwa-android';
      if (this._isWindows()) return 'pwa-windows';
      if (this._isMac()) return 'pwa-macos';
      return 'pwa';
    }
    return 'browser';
  },

  getInstallLabel() {
    const labels = {
      'electron-windows': 'Windows (app de escritorio)',
      'electron-macos': 'macOS (app de escritorio)',
      electron: 'Escritorio (app nativa)',
      'pwa-ios': 'iPhone / iPad',
      'pwa-android': 'Android',
      'pwa-windows': 'Windows (PWA)',
      'pwa-macos': 'macOS (PWA)',
      pwa: 'App instalada (PWA)',
      browser: 'Navegador',
    };
    return labels[this.getInstallKind()] || 'App instalada';
  },

  getVersionLabel() {
    const running = this._getRunningVersion();
    return running || this._getLocalVersion() || '—';
  },

  canInstall() {
    return !!this._deferredPrompt;
  },

  isInstalled() {
    this._refreshInstallState();
    if (this._isElectronApp) return true;
    if (this._isStandalone) return true;
    if (localStorage.getItem(PWA_INSTALLED_KEY) === '1' && this._inInstalledDisplayMode()) return true;
    return false;
  },

  async promptInstall() {
    // Android / Chrome desktop: native PWA prompt
    if (this._deferredPrompt) {
      this._deferredPrompt.prompt();
      await this._deferredPrompt.userChoice;
      this._deferredPrompt = null;
      this._hideBanner();
      return true;
    }
    // iPhone / iPad — Safari only
    if (this._isIos() && !this._isStandalone) {
      App.openModal({
        title: '📲 Instalar en iPhone/iPad',
        body: `<ol style="font-size:14px;line-height:1.7;padding-left:18px;color:var(--text-secondary)">
          <li>Abre esta app en <strong>Safari</strong></li>
          <li>Pulsa el botón <strong>Compartir</strong> (cuadrado con flecha)</li>
          <li>Elige <strong>"Añadir a pantalla de inicio"</strong></li>
        </ol>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">Se crea un icono como cualquier app nativa, sin pagar nada a Apple.</p>`,
        actions: [{ label: 'Entendido', primary: true }],
      });
      return true;
    }
    // Windows: offer native installer download OR browser PWA
    if (this._isWindows() && !this._isStandalone) {
      App.openModal({
        title: '💻 Instalar en Windows',
        body: `
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:14px">
            Elige cómo quieres instalar la app:
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
            <a href="${WINDOWS_EXE_URL}" download
              style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--primary);color:#fff;text-decoration:none;font-weight:600;font-size:13px">
              <span style="font-size:22px">⬇️</span>
              <div>
                <div>Descargar instalador .exe</div>
                <div style="font-size:11px;font-weight:400;opacity:.85">Escritorio + menú Inicio · carga siempre la app de Vercel (misma versión que la web)</div>
              </div>
            </a>
            <button onclick="App._closeModal()" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border);cursor:pointer;font-size:13px;text-align:left">
              <span style="font-size:22px">🌐</span>
              <div>
                <div style="font-weight:600">Instalar desde Chrome / Edge</div>
                <div style="font-size:11px;color:var(--text-secondary)">Busca el icono ⊕ en la barra de direcciones o menú ⋮ → Instalar</div>
              </div>
            </button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;background:var(--bg);padding:8px 10px;border-radius:8px">
            Si Windows muestra <strong>"Windows protegió tu PC"</strong> → <em>Más información</em> → <em>Ejecutar de todas formas</em>. Es normal: el instalador no está firmado con certificado de pago.
          </div>`,
        actions: [],
      });
      return true;
    }
    // macOS / other
    App.openModal({
      title: '💻 Instalar la app',
      body: `<p style="font-size:14px;color:var(--text-secondary);line-height:1.6">
        En <strong>Chrome</strong> o <strong>Edge</strong>, busca el icono de instalación (⊕) en la barra de direcciones
        o abre el menú y elige <strong>"Instalar Presupuesto"</strong>.<br><br>
        En <strong>Safari (macOS)</strong>: Archivo → Añadir al Dock.
      </p>`,
      actions: [{ label: 'Entendido', primary: true }],
    });
    return false;
  },

  _showBanner() {
    if (this.isInstalled()) return;
    let banner = document.getElementById('installBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'installBanner';
      banner.className = 'install-banner';
      const isWin = this._isWindows();
      banner.innerHTML = `
        <div class="install-banner-text">
          <strong>${isWin ? '⬇️ Instala la app' : '📲 Instala la app'}</strong>
          <span>${isWin ? 'Descarga el instalador .exe o instala desde Chrome' : 'Úsala sin navegador y con acceso rápido'}</span>
        </div>
        <div class="install-banner-actions">
          ${isWin ? `<a href="${WINDOWS_EXE_URL}" download class="btn btn-primary btn-sm" style="text-decoration:none">⬇ .exe</a>` : ''}
          <button class="btn ${isWin ? 'btn-secondary' : 'btn-primary'} btn-sm" id="installBannerBtn">${isWin ? '🌐 PWA' : 'Instalar'}</button>
          <button class="btn btn-secondary btn-sm" id="installBannerDismiss">✕</button>
        </div>`;
      document.body.appendChild(banner);
      document.getElementById('installBannerBtn').addEventListener('click', () => this.promptInstall());
      document.getElementById('installBannerDismiss').addEventListener('click', () => {
        sessionStorage.setItem('installBannerDismissed', '1');
        this._hideBanner();
      });
    }
    banner.style.display = 'flex';
  },

  _showIosHint() {
    if (!this._isIos() || this._isStandalone) return;
    let hint = document.getElementById('iosInstallHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'iosInstallHint';
      hint.className = 'ios-install-hint';
      hint.innerHTML = `📲 En Safari: Compartir → <strong>Añadir a pantalla de inicio</strong>
        <button onclick="this.parentElement.remove()" style="margin-left:8px;border:none;background:none;cursor:pointer;font-size:14px">✕</button>`;
      document.body.appendChild(hint);
      setTimeout(() => hint?.remove(), 12000);
    }
  },

  _hideBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
  },

  _updateSyncBadge() {
    const el = document.getElementById('syncStatusBadge');
    if (!el || typeof Store === 'undefined') return;
    const status = Store.getSyncStatus();
    const labels = {
      synced: { text: 'Sincronizado', cls: 'sync-ok' },
      syncing: { text: 'Sincronizando…', cls: 'sync-pending' },
      local: { text: 'Solo local', cls: 'sync-local' },
      offline: { text: 'Sin conexión', cls: 'sync-offline' },
    };
    const info = labels[status] || labels.offline;
    el.className = `sync-status-badge ${info.cls}`;
    el.title = Store.getSyncStatusDetail();
    el.textContent = info.text;
  },
};

document.addEventListener('DOMContentLoaded', () => Install.init());
