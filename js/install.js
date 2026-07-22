const WINDOWS_EXE_URL = 'https://github.com/ddanieldsdd-glitch/app-ahorro/releases/download/v2.0.4/Presupuesto.Personal.Setup.2.0.4.exe';

const Install = {
  _deferredPrompt: null,
  _isStandalone: false,
  _swRegistration: null,

  init() {
    this._isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this._showBanner();
    });

    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      this._hideBanner();
      if (typeof VercelAnalytics !== 'undefined') VercelAnalytics.track('app_installed');
      if (typeof App !== 'undefined') App.showToast('✅ App instalada correctamente');
    });

    if (!this._isStandalone && !this._deferredPrompt) {
      const dismissed = sessionStorage.getItem('installBannerDismissed');
      if (!dismissed && this._isMobile()) this._showIosHint();
    }

    this._updateSyncBadge();
    if (typeof Store !== 'undefined') {
      Store.onSyncStatusChange(() => this._updateSyncBadge());
    }

    this._setupUpdateDetection();
    this._fetchRemoteVersion().then((v) => {
      if (v && !this._getLocalVersion()) this._setLocalVersion(v);
    });
  },

  // ── Update detection ──────────────────────────────────────────────────────

  _setupUpdateDetection() {
    if (!('serviceWorker' in navigator)) {
      this._checkRemoteVersion(false);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this._onAppForeground();
      });
      window.addEventListener('pageshow', (e) => { if (e.persisted) this._onAppForeground(); });
      setInterval(() => this._checkRemoteVersion(false), 5 * 60 * 1000);
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
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });

    this._checkRemoteVersion(false);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._onAppForeground();
    });
    window.addEventListener('pageshow', (e) => { if (e.persisted) this._onAppForeground(); });
    window.addEventListener('focus', () => this._onAppForeground());
    setInterval(() => this._onAppForeground(), 5 * 60 * 1000);
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
    const paths = ['/version-check.json', '/version.json'];
    for (const path of paths) {
      try {
        const res = await fetch(`${path}?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        const v = data.cache || data.version || null;
        if (v) return v;
      } catch { /* try next path */ }
    }
    return null;
  },

  _getRunningVersion() {
    const meta = document.querySelector('meta[name="app-cache-version"]');
    return meta?.content || window.__APP_CACHE_VERSION || '';
  },

  _getLocalVersion() {
    return localStorage.getItem('_appCacheVersion') || this._getRunningVersion() || '';
  },

  _setLocalVersion(v) {
    if (v) localStorage.setItem('_appCacheVersion', v);
  },

  async _checkRemoteVersion(showIfCurrent) {
    const remote = await this._fetchRemoteVersion();
    if (!remote) return false;
    const running = this._getRunningVersion();
    const stored = this._getLocalVersion();
    const baseline = running || stored;
    if (!baseline) {
      this._setLocalVersion(remote);
      return false;
    }
    if (baseline !== remote) {
      this._showUpdateBanner('version');
      return true;
    }
    this._setLocalVersion(remote);
    if (showIfCurrent && typeof App !== 'undefined') {
      App.showToast(`✅ App al día (${remote})`);
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

  async manualCheckForUpdates() {
    if (typeof App !== 'undefined') App.showToast('🔍 Comprobando actualizaciones…', 2000);

    const swUpdate = await this._checkServiceWorkerUpdate();
    const remote = await this._fetchRemoteVersion();
    const running = this._getRunningVersion();

    const versionUpdate = !!(remote && running && remote !== running);
    const bannerVisible = !!document.getElementById('updateBanner');

    if (swUpdate || versionUpdate) {
      if (!bannerVisible) this._showUpdateBanner(swUpdate ? 'sw' : 'version');
      if (typeof App !== 'undefined') {
        App.showToast('🔄 Hay una actualización disponible', 4000);
      }
      return;
    }

    if (typeof App !== 'undefined') {
      const label = remote || running || 'desconocida';
      App.showToast(`✅ App al día (${label})`);
    }
  },

  _showUpdateBanner(source) {
    if (document.getElementById('updateBanner')) return; // already showing
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <div class="update-banner-text">
        <strong>🔄 Actualización disponible</strong>
        <span>Hay una nueva versión de la app</span>
      </div>
      <div class="update-banner-actions">
        <button class="btn btn-primary btn-sm" id="updateBannerBtn">Actualizar ahora</button>
        <button class="btn btn-secondary btn-sm" id="updateBannerDismiss">Luego</button>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('updateBannerBtn').addEventListener('click', async () => {
      const reg = this._swRegistration || await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (reg?.installing) {
        reg.installing.postMessage({ type: 'SKIP_WAITING' });
      }
      try {
        const remote = await this._fetchRemoteVersion();
        if (remote) this._setLocalVersion(remote);
      } catch { /* ignore */ }
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch { /* ignore */ }
      window.location.reload();
    });
    document.getElementById('updateBannerDismiss').addEventListener('click', () => {
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
    return /Mac/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent);
  },

  _isElectron() {
    return !!(
      (window.CapacitorCustomPlatform && window.CapacitorCustomPlatform.name === 'electron') ||
      /Electron/i.test(navigator.userAgent)
    );
  },

  getInstallKind() {
    if (this._isElectron()) {
      if (this._isWindows()) return 'electron-windows';
      if (this._isMac()) return 'electron-macos';
      return 'electron';
    }
    if (this._isStandalone) {
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
    return this._isStandalone || this._isElectron();
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
    if (this._isStandalone) return;
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
