/**
 * StoragePrefs — carpeta preferida para exportar/importar y copias locales.
 * Usa File System Access API + IndexedDB para persistir el handle de carpeta.
 */
const StoragePrefs = {
  PREFS_KEY: 'ahorro_storage_prefs',
  DB_NAME: 'ahorro_fs',
  STORE: 'handles',
  HANDLE_KEY: 'exportDir',

  _defaultPrefs() {
    return {
      configured: false,
      mode: 'picker', // 'picker' | 'folder'
      dirLabel: '',
      autoBackupToFolder: false,
    };
  },

  getPrefs() {
    try {
      const raw = localStorage.getItem(this.PREFS_KEY);
      return raw ? { ...this._defaultPrefs(), ...JSON.parse(raw) } : this._defaultPrefs();
    } catch {
      return this._defaultPrefs();
    }
  },

  setPrefs(patch) {
    const next = { ...this.getPrefs(), ...patch, configured: true };
    localStorage.setItem(this.PREFS_KEY, JSON.stringify(next));
    return next;
  },

  isConfigured() {
    return !!this.getPrefs().configured;
  },

  supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === 'function';
  },

  getDisplayLabel() {
    const p = this.getPrefs();
    if (p.mode === 'folder' && p.dirLabel) return p.dirLabel;
    if (p.mode === 'folder') return 'Carpeta del dispositivo';
    return 'Selector del sistema (cada vez)';
  },

  async _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(this.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _saveHandle(handle) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put(handle, this.HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async _loadHandle() {
    try {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readonly');
        const req = tx.objectStore(this.STORE).get(this.HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async getExportDirectoryHandle() {
    const p = this.getPrefs();
    if (p.mode !== 'folder') return null;
    const handle = await this._loadHandle();
    if (!handle) return null;
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return handle;
      const req = await handle.requestPermission({ mode: 'readwrite' });
      return req === 'granted' ? handle : null;
    } catch {
      return null;
    }
  },

  async pickExportDirectory() {
    if (!this.supportsDirectoryPicker()) {
      if (typeof App !== 'undefined') {
        App.showToast('Tu navegador no permite elegir carpeta — se usará el selector de archivos', 4000);
      }
      this.setPrefs({ mode: 'picker', dirLabel: '' });
      return false;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this._saveHandle(handle);
      this.setPrefs({ mode: 'folder', dirLabel: handle.name || 'Carpeta' });
      if (typeof App !== 'undefined') App.showToast(`✅ Carpeta: ${handle.name}`);
      return true;
    } catch (e) {
      if (e.name !== 'AbortError' && typeof App !== 'undefined') {
        App.showToast('❌ No se pudo acceder a la carpeta', 3500);
      }
      return false;
    }
  },

  useSystemPickerEachTime() {
    this.setPrefs({ mode: 'picker', dirLabel: '' });
    if (typeof App !== 'undefined') App.showToast('✅ Se abrirá el selector del sistema en cada exportación/importación');
  },

  async mirrorBackupToFolder(jsonStr, filename = 'presupuesto_backup.json') {
    const dir = await this.getExportDirectoryHandle();
    if (!dir) return false;
    try {
      const fileHandle = await dir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  },

  showSetupWizard() {
    if (this.isConfigured()) return;
    if (typeof App === 'undefined') return;

    const canFolder = this.supportsDirectoryPicker();
    App.openModal({
      title: '📁 ¿Dónde guardar tus archivos?',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.6">
          Elige la carpeta del dispositivo para <strong>exportar e importar</strong> backups (JSON/Excel).
          Tus datos de la app siguen guardados en el navegador; esto solo afecta a los archivos que exportes.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
          ${canFolder ? `
          <button class="btn btn-primary" onclick="StoragePrefs._wizardPickFolder()" style="font-size:13px;padding:12px;text-align:left">
            📂 Elegir carpeta en este dispositivo
            <div style="font-size:11px;font-weight:400;opacity:.9;margin-top:4px">Recomendado en PC — exportar/importar abrirá esa carpeta</div>
          </button>` : ''}
          <button class="btn btn-secondary" onclick="StoragePrefs._wizardUsePicker()" style="font-size:13px;padding:12px;text-align:left">
            💾 Preguntarme en cada exportación/importación
            <div style="font-size:11px;font-weight:400;opacity:.85;margin-top:4px">Selector de archivos del sistema cada vez</div>
          </button>
        </div>
        <p style="font-size:11px;color:var(--text-secondary);line-height:1.5">
          Puedes cambiar esto después en <strong>Configuración → Almacenamiento de archivos</strong>.
        </p>`,
      actions: [{ label: 'Decidir más tarde', cb: () => StoragePrefs._wizardLater() }],
    });
  },

  async _wizardPickFolder() {
    const ok = await this.pickExportDirectory();
    App._closeModal?.();
    if (ok && typeof Categorias !== 'undefined') Categorias.render?.();
  },

  _wizardUsePicker() {
    this.useSystemPickerEachTime();
    App._closeModal?.();
    if (typeof Categorias !== 'undefined') Categorias.render?.();
  },

  _wizardLater() {
    localStorage.setItem(this.PREFS_KEY, JSON.stringify({ ...this.getPrefs(), configured: true, mode: 'picker' }));
    App._closeModal?.();
  },

  renderSettingsCard() {
    const p = this.getPrefs();
    const label = this.getDisplayLabel();
    const canFolder = this.supportsDirectoryPicker();
    return `
      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">📁 Almacenamiento de archivos</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Carpeta preferida para exportar e importar backups. Los datos de la app se guardan en el navegador
          y, si lo configuras, también en la nube (Supabase).
        </p>
        <div style="font-size:12px;margin-bottom:10px;padding:8px 10px;background:var(--bg);border-radius:8px">
          <strong>Ubicación actual:</strong> ${esc(label)}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${canFolder ? `<button class="btn btn-primary btn-sm" onclick="StoragePrefs.pickExportDirectory().then(() => Categorias.render())">📂 Elegir carpeta</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="StoragePrefs.useSystemPickerEachTime(); Categorias.render();">💾 Selector cada vez</button>
        </div>
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;cursor:pointer;line-height:1.5">
          <input type="checkbox" id="storageAutoBackupFolder" ${p.autoBackupToFolder ? 'checked' : ''}
            onchange="StoragePrefs.setPrefs({ autoBackupToFolder: this.checked })">
          <span>Guardar copia JSON en la carpeta al actualizar la app (si hay carpeta configurada)</span>
        </label>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;line-height:1.5">
          Al exportar o importar siempre se te preguntará dónde guardar o qué archivo abrir.
          ${canFolder ? 'Con carpeta elegida, el selector empezará ahí.' : 'Tu navegador no soporta carpeta fija; se usará el selector de archivos.'}
        </div>
      </div>`;
  },
};
