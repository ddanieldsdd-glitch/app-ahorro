const WINDOWS_EXE_URL = 'https://github.com/ddanieldsdd-glitch/app-ahorro/releases/download/v2.0.1/Presupuesto.Personal.Setup.2.0.1.exe';

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
  },

  // ── Update detection ──────────────────────────────────────────────────────

  _setupUpdateDetection() {
    if (!('serviceWorker' in navigator)) return;

    // 1. Detect new SW version (CACHE bump in sw.js)
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
      // Proactively check for SW updates
      reg.update().catch(() => {});
    });

    // 2. When new SW takes control, reload the page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });

    // 3. Detect server restart (= new code deployed without SW cache bump)
    this._checkServerVersion();
    setInterval(() => this._checkServerVersion(), 5 * 60 * 1000); // every 5 min
  },

  async _checkServerVersion() {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = await res.json();
      const stored = sessionStorage.getItem('_appServerVersion');
      if (!stored) { sessionStorage.setItem('_appServerVersion', version); return; }
      if (String(stored) !== String(version)) {
        // Server restarted = new deployment
        sessionStorage.setItem('_appServerVersion', version);
        this._showUpdateBanner('server');
      }
    } catch { /* offline */ }
  },

  async manualCheckForUpdates() {
    if (this._swRegistration) {
      try { await this._swRegistration.update(); } catch { /* ignore */ }
    }
    // Reset stored version to force re-check
    sessionStorage.removeItem('_appServerVersion');
    await this._checkServerVersion();
    const banner = document.getElementById('updateBanner');
    if (!banner || banner.style.display === 'none') {
      if (typeof App !== 'undefined') App.showToast('✅ App al día, no hay actualizaciones');
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

    document.getElementById('updateBannerBtn').addEventListener('click', () => {
      const reg = this._swRegistration;
      if (source === 'sw' && reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Clear SW cache then reload so fresh files are fetched
        if (reg) {
          caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }
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

  canInstall() {
    return !!this._deferredPrompt;
  },

  isInstalled() {
    return this._isStandalone;
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
                <div style="font-size:11px;font-weight:400;opacity:.85">Instala como app nativa, con acceso directo en el Escritorio y el menú Inicio</div>
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
