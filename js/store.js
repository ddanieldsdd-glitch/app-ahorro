const STORAGE_KEY = 'ahorro_presupuesto';
const BACKUP_KEY = 'ahorro_backup';
const SYNC_SETTINGS_KEY = 'ahorro_sync_settings';
const SYNC_CONFLICT_KEY = 'ahorro_sync_conflict';
const PASSPHRASE_KEY = 'ahorro_passphrase';
const SYNC_INTERVAL = 4000;
const REALTIME_FALLBACK_INTERVAL = 30000;
const DEVICE_ID_KEY = 'ahorro_device_id';
const SHARED_SYNC_KEY    = 'ahorro_shared_sync';
const SHARED_STORAGE_KEY = 'ahorro_shared_debts';

// Global utilities (loaded first, available to all modules)
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function ringSVG(pct, size = 80, stroke = 8, color = '#4F46E5') {
  const r = (size - stroke) / 2;
  const c = Math.PI * 2 * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})" style="transition:stroke-dashoffset .6s ease"/>
  </svg>`;
}
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const defaultData = {
  transactions: [],
  categories: ['Comida', 'Bebida', 'Salidas', 'Caprichos', 'Transporte', 'Vivienda', 'Salud', 'Educación', 'Imprevisto', 'Otros'],
  incomeCategories: ['Mensualidad', 'Paga', 'Extra'],
  types: ['Ingreso', 'Gasto', 'Traspaso'],
  paymentMethods: ['Efectivo', 'Tarjeta', 'Bizum', 'Transferencia'],
  currentMonth: null,
  archives: {},
  budgetConfig: { weeklyIncome: 70, monthlyExtra: 100, categoryLimits: {} },
  savingGoals: [],
  roundUpEnabled: true,
  roundUpGoalId: null,
  totalRoundUpSavings: 0,
  foodBudget: 200,
  imprevistosBudget: 0,
  imprevistosSavings: 0,
  checkingBalance: null,
  checkingBaseBalance: 0,
  savingsBalance: 0,
  cashBalance: 0,
  transfers: [],
  pinCode: null,
  plannedExpenses: [],
  txGroups: {},
  lastSavingsWeek: null,
  lastPEReserveWeek: null,
  savingsDay: 1,
  plannedExpensesReserved: 0,
  foodCategories: [],
  categoryGroups: [],
  incomeGroups: [],
  expensePriorities: {},
  priorityIncludes: { groups: [], categories: [], customized: false },
  debts: [],
  people: [],
  peopleGroups: [],
  recurringTransactions: [],
  catalogEmojis: { category: {}, incomeCategory: {}, type: {}, method: {} },
  emojiLibrary: { custom: [], usage: {} },
  initialCheckingBalance: 0,
  initialSavingsBalance: 0,
  _balanceMigrated: false,
  _lastModified: 0,
};

const Store = {
  _data: null,
  _ready: false,
  _callbacks: [],
  _saveCallbacks: [],
  _syncStatusCallbacks: [],
  _syncTimer: null,
  _syncStatus: 'offline',
  _syncStatusDetail: 'Iniciando…',
  _syncConflict: null,
  _cloudDiff: null,
  _cloudDiffCallbacks: [],
  _realtimeChannel: null,
  _realtimeDebounce: null,
  _localDirty: false,
  _lastPushedFingerprint: '',
  _pushInFlight: false,

  // ── Shared space (partner debts) ───────────────────────────────────────────
  _sharedData: { debts: [], _lastModified: 0 },
  _sharedTimer: null,
  _sharedCallbacks: [],

  getSyncSettings() {
    try {
      const raw = localStorage.getItem(SYNC_SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { provider: 'supabase', serverUrl: '', syncKey: '', supabaseUrl: '', supabaseAnonKey: '', supabaseRowId: '' };
  },

  setSyncSettings(settings) {
    // Accepts either (serverUrl, syncKey) legacy or a settings object
    let obj;
    if (typeof settings === 'string') {
      // Legacy call: setSyncSettings(serverUrl, syncKey)
      const serverUrl = settings;
      const syncKey = arguments[1] || '';
      const prev = this.getSyncSettings();
      obj = { ...prev, provider: 'custom', serverUrl: serverUrl.trim().replace(/\/+$/, ''), syncKey };
    } else {
      const prev = this.getSyncSettings();
      obj = {
        provider: settings.provider || prev.provider || 'supabase',
        serverUrl: (settings.serverUrl || '').trim().replace(/\/+$/, ''),
        syncKey: settings.syncKey || '',
        supabaseUrl: this._normalizeSupabaseUrl(settings.supabaseUrl || ''),
        supabaseAnonKey: settings.supabaseAnonKey || '',
        supabaseRowId: settings.supabaseRowId || prev.supabaseRowId || 'default',
      };
    }
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(obj));
    this._setSyncStatus('syncing', 'Aplicando nueva configuración…');
    this._startSync();
    this._safeConnectSync();
  },

  async _safeConnectSync() {
    if (!navigator.onLine) {
      this._syncNow();
      return;
    }
    const remote = await this._fetchRemoteData();
    const result = this._pickSyncWinner(this._data, remote);
    if (result.conflict) {
      this._registerSyncConflict(result.conflict);
      this._setSyncStatus('local', 'Hay datos distintos en la nube — elige qué conservar');
      return;
    }
    await this._syncNow();
  },

  // ── Supabase helpers ────────────────────────────────────────────────────────
  /** Accepts API URL, dashboard URL, or bare project ref → https://<ref>.supabase.co */
  _normalizeSupabaseUrl(raw) {
    const s = String(raw || '').trim().replace(/\/+$/, '');
    if (!s) return '';
    const dash = s.match(/supabase\.com\/(?:dashboard\/)?project\/([a-z0-9]+)/i);
    if (dash) return `https://${dash[1]}.supabase.co`;
    if (/^[a-z0-9]{15,}$/i.test(s)) return `https://${s}.supabase.co`;
    try {
      const u = new URL(s.startsWith('http') ? s : `https://${s}`);
      if (u.hostname.endsWith('.supabase.co')) return `https://${u.hostname}`;
    } catch { /* ignore */ }
    return s;
  },

  _supabaseErrorHint(message) {
    const msg = String(message || '');
    if (/permission denied|42501/i.test(msg)) {
      return 'Sin permisos en sync_data. Abre SQL Editor y ejecuta el SQL de configuración (incluye GRANT).';
    }
    if (/does not exist|42P01/i.test(msg)) {
      return 'Falta la tabla sync_data. Ejecuta el SQL de configuración en Supabase → SQL Editor.';
    }
    if (/Failed to fetch|NetworkError|Invalid URL|ENOTFOUND/i.test(msg)) {
      return 'URL incorrecta. Usa https://xxxxx.supabase.co (no el enlace del panel).';
    }
    return msg || 'Error de Supabase';
  },

  _isSupabase() {
    const s = this.getSyncSettings();
    return s.provider === 'supabase' && !!(s.supabaseUrl && s.supabaseAnonKey);
  },

  _getSupabaseClient() {
    const { supabaseUrl, supabaseAnonKey } = this.getSyncSettings();
    // window.supabase is provided by the CDN script in index.html
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  },

  async _pushToSupabase(blob) {
    const { supabaseRowId } = this.getSyncSettings();
    const id = supabaseRowId || 'default';
    const { error } = await this._getSupabaseClient()
      .from('sync_data')
      .upsert({ id, payload: blob });
    if (error) throw new Error(this._supabaseErrorHint(error.message));
    return true;
  },

  async _pullFromSupabase() {
    const { supabaseRowId } = this.getSyncSettings();
    const id = supabaseRowId || 'default';
    const { data, error } = await this._getSupabaseClient()
      .from('sync_data')
      .select('payload')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(this._supabaseErrorHint(error.message));
    return data ? data.payload : null;
  },

  /** Descarga y descifra el blob remoto sin aplicarlo localmente. */
  async _fetchRemoteData() {
    try {
      let rawBlob;
      if (this._isSupabase()) {
        rawBlob = await this._pullFromSupabase();
        if (!rawBlob) return null;
      } else {
        const res = await this._apiFetch('/api/data');
        if (!res.ok) return null;
        rawBlob = await res.json();
      }
      return await this._decryptFromServer(rawBlob);
    } catch {
      return null;
    }
  },

  _dataTimestamp(data) {
    return data?._lastModified || 0;
  },

  _countMovements(data) {
    if (!data) return 0;
    const cur = data.transactions?.length || 0;
    const arch = Object.values(data.archives || {}).reduce((n, txs) => n + (txs?.length || 0), 0);
    return cur + arch;
  },

  _dataScore(data) {
    if (!data) return 0;
    let score = this._countMovements(data) * 10;
    score += (data.debts?.length || 0) * 5;
    score += (data.savingGoals?.length || 0) * 5;
    score += (data.plannedExpenses?.length || 0) * 3;
    score += (data.recurringTransactions?.length || 0) * 3;
    if (data.checkingBalance !== null && data.checkingBalance !== undefined && data.checkingBalance !== 0) score += 8;
    if (data.savingsBalance) score += 5;
    if (data.cashBalance) score += 3;
    if ((data.people?.length || 0) > 0) score += 2;
    return score;
  },

  _hasSubstantialData(data) {
    return this._dataScore(data) > 0;
  },

  _isFactoryLike(data) {
    return !this._hasSubstantialData(data);
  },

  _describeDataBrief(data) {
    const txs = this._countMovements(data);
    const parts = [`${txs} movimiento${txs === 1 ? '' : 's'}`];
    if (data?.debts?.length) parts.push(`${data.debts.length} deuda${data.debts.length === 1 ? '' : 's'}`);
    if (data?.savingGoals?.length) parts.push(`${data.savingGoals.length} meta${data.savingGoals.length === 1 ? '' : 's'}`);
    return parts.join(' · ') || 'sin datos (estado base)';
  },

  _formatSyncTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '—';
    }
  },

  _dataFingerprint(data) {
    if (!data) return '';
    const ids = [
      ...(data.transactions || []).map(t => t.id),
      ...Object.values(data.archives || {}).flat().map(t => t.id),
    ].filter(Boolean).sort();
    return [
      this._countMovements(data),
      this._dataScore(data),
      data._lastModified || 0,
      ids.length,
      ids.slice(0, 40).join('|'),
    ].join(':');
  },

  _contentDiffers(localData, remoteData) {
    if (!localData || !remoteData) return false;
    if (this._dataFingerprint(localData) === this._dataFingerprint(remoteData)) return false;
    return true;
  },

  onCloudDiffChange(cb) { this._cloudDiffCallbacks.push(cb); },

  _notifyCloudDiff() {
    this._cloudDiffCallbacks.forEach(cb => cb(this._cloudDiff));
  },

  getCloudDiff() {
    return this._cloudDiff;
  },

  /** Compara dispositivo vs nube sin aplicar cambios. */
  async detectCloudDifference() {
    const s = this.getSyncSettings();
    const hasBackend = this._isSupabase() || !!s.serverUrl;
    if (!hasBackend || !navigator.onLine) {
      this._cloudDiff = null;
      this._notifyCloudDiff();
      return null;
    }
    const remote = await this._fetchRemoteData();
    const local = this._data;
    if (!remote) {
      this._cloudDiff = null;
      this._notifyCloudDiff();
      return null;
    }
    if (!this._contentDiffers(local, remote)) {
      this._cloudDiff = null;
      this._notifyCloudDiff();
      return null;
    }
    const localTs = this._dataTimestamp(local);
    const remoteTs = this._dataTimestamp(remote);
    this._cloudDiff = {
      local,
      remote,
      localSummary: this._describeDataBrief(local),
      remoteSummary: this._describeDataBrief(remote),
      localTs,
      remoteTs,
      localNewer: localTs > remoteTs,
      remoteNewer: remoteTs > localTs,
      detectedAt: Date.now(),
    };
    this._notifyCloudDiff();
    return this._cloudDiff;
  },

  /** Sube los datos locales a la nube (reemplaza la copia remota). */
  async pushLocalToCloud() {
    if (!this._data) return { ok: false, message: 'Sin datos locales' };
    this._backup('pre-cloud-upload');
    this._data._lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    const ok = await this._pushToServer({ force: true, allowOverwrite: true });
    if (ok) {
      this.clearSyncConflict();
      this._cloudDiff = null;
      this._notifyCloudDiff();
      this._setSyncStatus('synced', 'Datos de este dispositivo subidos a la nube');
      this._callbacks.forEach(cb => cb());
      return { ok: true, message: 'Datos subidos a la nube' };
    }
    return { ok: false, message: this.getSyncStatusDetail() || 'No se pudo subir a la nube' };
  },

  /** Descarga datos de la nube a este dispositivo. */
  async pullCloudToDevice() {
    const remote = await this._fetchRemoteData();
    if (!remote) return { ok: false, message: 'No hay datos en la nube' };
    this._backup('pre-cloud-download');
    this._applyLocalData(remote);
    this._localDirty = false;
    this._lastPushedFingerprint = this._dataFingerprint(remote);
    this.clearSyncConflict();
    this._cloudDiff = null;
    this._notifyCloudDiff();
    this._setSyncStatus('synced', 'Datos de la nube aplicados en este dispositivo');
    return { ok: true, message: 'Datos de la nube descargados' };
  },

  _tryRestoreFromBackup() {
    const candidates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(BACKUP_KEY + '_')) candidates.push(k);
    }
    candidates.sort().reverse();
    for (const key of candidates) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        if (this._hasSubstantialData(parsed)) return parsed;
      } catch { /* ignore */ }
    }
    return null;
  },

  _registerSyncConflict({ reason, local, remote }) {
    this._syncConflict = { reason, local, remote, at: Date.now() };
    try {
      localStorage.setItem(SYNC_CONFLICT_KEY, JSON.stringify({
        reason,
        at: this._syncConflict.at,
        localSummary: this._describeDataBrief(local),
        remoteSummary: this._describeDataBrief(remote),
        localScore: this._dataScore(local),
        remoteScore: this._dataScore(remote),
      }));
      localStorage.setItem(SYNC_CONFLICT_KEY + '_local', JSON.stringify(local));
      localStorage.setItem(SYNC_CONFLICT_KEY + '_remote', JSON.stringify(remote));
    } catch { /* quota — keep in memory only */ }
  },

  getSyncConflict() {
    if (this._syncConflict) return this._syncConflict;
    try {
      const meta = JSON.parse(localStorage.getItem(SYNC_CONFLICT_KEY) || 'null');
      if (!meta) return null;
      const local = JSON.parse(localStorage.getItem(SYNC_CONFLICT_KEY + '_local') || 'null');
      const remote = JSON.parse(localStorage.getItem(SYNC_CONFLICT_KEY + '_remote') || 'null');
      if (local && remote) {
        this._syncConflict = { ...meta, local, remote };
        return this._syncConflict;
      }
    } catch { /* ignore */ }
    return null;
  },

  clearSyncConflict() {
    this._syncConflict = null;
    localStorage.removeItem(SYNC_CONFLICT_KEY);
    localStorage.removeItem(SYNC_CONFLICT_KEY + '_local');
    localStorage.removeItem(SYNC_CONFLICT_KEY + '_remote');
  },

  async resolveSyncConflict(choice) {
    const conflict = this.getSyncConflict();
    if (conflict) {
      this._backup('pre-sync-conflict');
    }
    if (choice === 'remote') {
      const result = await this.pullCloudToDevice();
      return result.ok;
    }
    if (choice === 'local') {
      const result = await this.pushLocalToCloud();
      return result.ok;
    }
    return false;
  },

  /** Elige la copia más reciente; nunca pisa datos reales con estado base sin preguntar. */
  _pickSyncWinner(localData, remoteData) {
    if (!remoteData) {
      return { winner: localData, shouldPush: this._hasSubstantialData(localData) };
    }
    if (!localData) {
      return { winner: remoteData, shouldPush: false };
    }

    const localScore = this._dataScore(localData);
    const remoteScore = this._dataScore(remoteData);
    const localTs = this._dataTimestamp(localData);
    const remoteTs = this._dataTimestamp(remoteData);

    // Dispositivo nuevo / local vacío → adoptar nube sin preguntar
    if (localScore === 0 && remoteScore > 0) {
      return { winner: remoteData, shouldPush: false };
    }
    // Local con datos, nube vacía → conservar local y subir
    if (localScore > 0 && remoteScore === 0) {
      return { winner: localData, shouldPush: true };
    }
    // Ambos con datos distintos → resolver sin preguntar (un solo dispositivo habitual)
    if (localScore > 0 && remoteScore > 0 && this._contentDiffers(localData, remoteData)) {
      if (localTs > remoteTs) return { winner: localData, shouldPush: true };
      return { winner: remoteData, shouldPush: false };
    }
    // Nube vacía intentando pisar local con datos
    if (localScore > 0 && remoteScore === 0 && remoteTs > localTs) {
      return { winner: localData, shouldPush: true };
    }
    // Local vacío intentando pisar nube
    if (remoteScore > 0 && localScore === 0 && localTs > remoteTs) {
      return { winner: remoteData, shouldPush: false };
    }

    if (remoteTs > localTs) return { winner: remoteData, shouldPush: false };
    if (localTs > remoteTs) return { winner: localData, shouldPush: true };
    if (remoteScore > localScore) return { winner: remoteData, shouldPush: false };
    if (localScore > remoteScore) return { winner: localData, shouldPush: true };
    return { winner: remoteData, shouldPush: false };
  },

  /** Comprueba si otro dispositivo modificó la nube desde nuestra última sync. */
  _remoteChangedSinceLastSync(remote) {
    if (!remote) return false;
    const remoteFp = this._dataFingerprint(remote);
    if (remoteFp === this._lastPushedFingerprint) return false;
    return this._hasSubstantialData(remote);
  },

  _registerMultiDeviceConflict(local, remote) {
    const localTs = this._dataTimestamp(local);
    const remoteTs = this._dataTimestamp(remote);
    this._registerSyncConflict({ reason: 'simultaneous', local, remote });
    this._cloudDiff = {
      local,
      remote,
      localSummary: this._describeDataBrief(local),
      remoteSummary: this._describeDataBrief(remote),
      localTs,
      remoteTs,
      localNewer: localTs > remoteTs,
      remoteNewer: remoteTs > localTs,
      detectedAt: Date.now(),
    };
    this._notifyCloudDiff();
    this._setSyncStatus('local', 'Otro dispositivo editó la nube — elige qué conservar');
    if (typeof App !== 'undefined') {
      setTimeout(() => App._checkSyncConflict?.(), 400);
    }
  },

  _getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  },

  /** Aplica cambios remotos si este dispositivo no está editando; si no, pide al usuario. */
  async _handleIncomingRemote(serverData, { source = 'poll', silent = false } = {}) {
    if (!serverData || !this._ready) return false;
    if (this.getSyncConflict()) return false;

    const remoteFp = this._dataFingerprint(serverData);
    const localFp = this._dataFingerprint(this._data);
    if (remoteFp === localFp) {
      this._localDirty = false;
      this._cloudDiff = null;
      this._notifyCloudDiff();
      return false;
    }
    if (remoteFp === this._lastPushedFingerprint) return false;

    const remoteTs = this._dataTimestamp(serverData);
    const localTs = this._dataTimestamp(this._data);
    const differs = this._contentDiffers(this._data, serverData);

    if (this._localDirty && differs) {
      this._registerMultiDeviceConflict(this._data, serverData);
      if (source === 'realtime' && typeof App !== 'undefined') {
        App.showToast?.('⚠️ Otro dispositivo cambió la nube', 4500);
      }
      return false;
    }

    if (!differs) return false;

    if (remoteTs >= localTs || !this._hasSubstantialData(this._data)) {
      this._applyLocalData(serverData);
      this._lastPushedFingerprint = remoteFp;
      this._localDirty = false;
      this._cloudDiff = null;
      this._notifyCloudDiff();
      const enc = this.isEncryptionEnabled();
      const live = source === 'realtime';
      this._setSyncStatus('synced', `${live ? 'Actualizado en vivo' : 'Sincronizado'}${enc ? ' 🔒' : ''}`);
      if (live && !silent && typeof App !== 'undefined') {
        App.showToast?.('🔄 Cambios de otro dispositivo aplicados', 3000);
      }
      return true;
    }

    if (localTs > remoteTs && !this._localDirty) {
      await this._pushToServer({ force: true, allowOverwrite: true });
      return true;
    }

    return false;
  },

  _stopRealtimeSync() {
    if (this._realtimeDebounce) {
      clearTimeout(this._realtimeDebounce);
      this._realtimeDebounce = null;
    }
    if (this._realtimeChannel) {
      try {
        const client = this._isSupabase() ? this._getSupabaseClient() : null;
        if (client) client.removeChannel(this._realtimeChannel);
      } catch { /* ignore */ }
      this._realtimeChannel = null;
    }
  },

  _startRealtimeSync() {
    this._stopRealtimeSync();
    if (!this._isSupabase()) return;

    const { supabaseRowId } = this.getSyncSettings();
    const id = supabaseRowId || 'default';
    const client = this._getSupabaseClient();

    this._realtimeChannel = client
      .channel(`sync-live-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sync_data',
        filter: `id=eq.${id}`,
      }, () => this._onRealtimeSyncSignal())
      .subscribe();
  },

  _onRealtimeSyncSignal() {
    if (!this._ready || this.getSyncConflict()) return;
    if (this._realtimeDebounce) clearTimeout(this._realtimeDebounce);
    this._realtimeDebounce = setTimeout(async () => {
      const remote = await this._fetchRemoteData();
      if (remote) await this._handleIncomingRemote(remote, { source: 'realtime' });
    }, 350);
  },

  isRealtimeActive() {
    return !!this._realtimeChannel;
  },

  _applyLocalData(data, notify = true) {
    this._data = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (notify) this._callbacks.forEach(cb => cb());
  },

  // ── Frase de cifrado (E2E) ─────────────────────────────────────────────────
  getPassphrase() {
    return localStorage.getItem(PASSPHRASE_KEY) || '';
  },

  setPassphrase(phrase) {
    if (phrase) localStorage.setItem(PASSPHRASE_KEY, phrase);
    else localStorage.removeItem(PASSPHRASE_KEY);
  },

  clearPassphrase() {
    localStorage.removeItem(PASSPHRASE_KEY);
  },

  isEncryptionEnabled() {
    return !!(this.getPassphrase() && typeof CryptoE2E !== 'undefined' && CryptoE2E.isAvailable());
  },

  // ── Cifrar antes de enviar / descifrar al recibir ─────────────────────────
  async _encryptForServer(dataObj) {
    const phrase = this.getPassphrase();
    if (!phrase || typeof CryptoE2E === 'undefined') return dataObj;
    const json = JSON.stringify(dataObj);
    const payload = await CryptoE2E.encrypt(json, phrase);
    payload._lastModified = dataObj._lastModified || Date.now();
    payload._encrypted = true;
    return payload;
  },

  async _decryptFromServer(blob) {
    if (!blob || !blob._encrypted) return blob;  // legacy o sin cifrado
    const phrase = this.getPassphrase();
    if (!phrase) throw new Error('Datos cifrados en el servidor pero no hay frase configurada en este dispositivo.');
    const plain = await CryptoE2E.decrypt(blob, phrase);
    return JSON.parse(plain);
  },

  getSyncStatus() { return this._syncStatus; },
  getSyncStatusDetail() { return this._syncStatusDetail; },
  onSyncStatusChange(cb) { this._syncStatusCallbacks.push(cb); },

  _setSyncStatus(status, detail) {
    this._syncStatus = status;
    this._syncStatusDetail = detail || '';
    this._syncStatusCallbacks.forEach(cb => cb(status, detail));
  },

  _apiBase() {
    const { serverUrl } = this.getSyncSettings();
    if (serverUrl) return serverUrl;
    return window.location.origin;
  },

  _apiHeaders(extra = {}) {
    const headers = { ...extra };
    const { syncKey } = this.getSyncSettings();
    if (syncKey) headers['X-Sync-Key'] = syncKey;
    return headers;
  },

  async _apiFetch(path, options = {}) {
    const url = `${this._apiBase()}${path}`;
    const headers = this._apiHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  },

  async init() {
    let loaded = false;
    let serverData = null;

    const raw = localStorage.getItem(STORAGE_KEY);
    let localData = null;
    if (raw) {
      try { localData = JSON.parse(raw); } catch (e) {}
    }

    // ── Supabase init ──────────────────────────────────────────────────────
    if (this._isSupabase()) {
      try {
        const rawBlob = await this._pullFromSupabase();
        if (rawBlob) {
          serverData = await this._decryptFromServer(rawBlob);
          loaded = true;
          const { supabaseUrl } = this.getSyncSettings();
          const host = new URL(supabaseUrl).hostname.replace('.supabase.co', '');
          const enc = this.isEncryptionEnabled();
          this._setSyncStatus('synced', `Conectado${enc ? ' 🔒' : ''} a Supabase (${host})`);
        }
      } catch (e) {
        this._setSyncStatus('offline', `Supabase: ${e.message || 'sin conexión'}`);
      }
    } else {
      // ── Custom server init ───────────────────────────────────────────────
      try {
        const res = await this._apiFetch('/api/data');
        if (res.ok) {
          const rawBlob = await res.json();
          serverData = await this._decryptFromServer(rawBlob);
          loaded = true;
          this._setSyncStatus('synced', 'Conectado al servidor');
        } else if (res.status === 401) {
          this._setSyncStatus('local', 'Clave de sincronización incorrecta');
        }
      } catch {
        this._setSyncStatus('offline', 'Sin conexión al servidor');
      }
    }

    if (loaded && serverData) {
      const result = this._pickSyncWinner(localData, serverData);
      if (result.conflict) {
        this._registerSyncConflict(result.conflict);
        if (localData && this._hasSubstantialData(localData)) {
          this._applyLocalData(localData, false);
        } else if (result.conflict.remote) {
          this._applyLocalData(result.conflict.remote, false);
        }
        this._setSyncStatus('local', 'Conflicto de datos — elige qué conservar');
      } else {
        this._applyLocalData(result.winner, false);
        if (result.shouldPush) await this._pushToServer({ force: true, allowOverwrite: true });
      }
    } else if (localData) {
      if (!this._hasSubstantialData(localData)) {
        const restored = this._tryRestoreFromBackup();
        if (restored) {
          this._data = restored;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
          if (navigator.onLine) this._setSyncStatus('local', 'Datos recuperados de backup local');
        } else {
          this._data = localData;
        }
      } else {
        this._data = localData;
      }
      if (navigator.onLine) {
        if (!this._syncConflict) this._setSyncStatus('local', 'Datos locales — nube no disponible');
      } else {
        this._setSyncStatus('offline', 'Modo sin conexión');
      }
    }

    if (!this._data || !Array.isArray(this._data.transactions)) {
      const restored = this._tryRestoreFromBackup();
      if (restored) {
        this._data = restored;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      } else {
        this._data = JSON.parse(JSON.stringify(defaultData));
        const now = new Date();
        this._data.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    this._migrate();
    this._ready = true;
    this._localDirty = false;
    if (this._data) this._lastPushedFingerprint = this._dataFingerprint(this._data);
    this._getDeviceId();
    this._startSync();
    this._bindConnectivity();
    // Init shared space (non-blocking, fires in background)
    this._initShared();
    return this._data;
  },

  _bindConnectivity() {
    window.addEventListener('online', () => this._syncNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._syncNow();
    });
  },

  async testSyncConnection() {
    if (this._isSupabase()) {
      try {
        const url = this.getSyncSettings().supabaseUrl;
        if (!/\.supabase\.co$/i.test(new URL(url).hostname)) {
          return { ok: false, message: 'URL incorrecta. Debe ser https://xxxxx.supabase.co' };
        }
        const { error } = await this._getSupabaseClient()
          .from('sync_data')
          .select('id')
          .limit(1);
        if (error) return { ok: false, message: this._supabaseErrorHint(error.message) };
        const host = new URL(url).hostname.replace('.supabase.co', '');
        return { ok: true, message: `Supabase conectado (${host})` };
      } catch (e) {
        return { ok: false, message: this._supabaseErrorHint(e.message) };
      }
    }
    try {
      const res = await this._apiFetch('/api/health');
      if (res.status === 401) return { ok: false, message: 'Clave de sincronización incorrecta' };
      if (!res.ok) return { ok: false, message: `Error del servidor (${res.status})` };
      const data = await res.json();
      return { ok: !!data.ok, message: 'Conexión correcta' };
    } catch {
      return { ok: false, message: 'No se pudo conectar al servidor' };
    }
  },

  async _pushToServer({ force = false, allowOverwrite = false } = {}) {
    if (!this._data) return false;

    const shouldPush = force || this._localDirty;

    // Evitar pisar la nube con datos vacíos/de fábrica
    if (!allowOverwrite || !shouldPush) {
      try {
        const remote = await this._fetchRemoteData();
        if (remote && this._hasSubstantialData(remote) && this._isFactoryLike(this._data)) {
          this._registerSyncConflict({
            reason: 'local_empty_remote_rich',
            local: this._data,
            remote,
          });
          this._setSyncStatus('local', 'La nube tiene datos — elige qué conservar antes de sincronizar');
          return false;
        }
      } catch { /* sin conexión */ }
      if (!shouldPush) return false;
    }

    // Varios dispositivos: la nube cambió mientras editábamos aquí
    if (shouldPush && allowOverwrite) {
      try {
        const remote = await this._fetchRemoteData();
        if (remote && this._contentDiffers(this._data, remote) && this._remoteChangedSinceLastSync(remote)) {
          this._registerMultiDeviceConflict(this._data, remote);
          return false;
        }
      } catch { /* sin conexión — intentar push abajo */ }
    }

    this._setSyncStatus('syncing', 'Enviando cambios…');
    try {
      const blob = await this._encryptForServer(this._data);
      const enc = this.isEncryptionEnabled();

      if (this._isSupabase()) {
        const ok = await this._pushToSupabase(blob);
        if (ok) {
          this._localDirty = false;
          this._lastPushedFingerprint = this._dataFingerprint(this._data);
          const { supabaseUrl } = this.getSyncSettings();
          const host = new URL(supabaseUrl).hostname.replace('.supabase.co', '');
          this._setSyncStatus('synced', `Sincronizado${enc ? ' 🔒' : ''} con Supabase (${host})`);
          return true;
        }
        this._setSyncStatus('local', 'No se pudo enviar a Supabase');
        return false;
      }

      const res = await this._apiFetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blob),
      });
      if (res.ok) {
        this._localDirty = false;
        this._lastPushedFingerprint = this._dataFingerprint(this._data);
        this._setSyncStatus('synced', `Sincronizado${enc ? ' 🔒' : ''} con ${this._apiBase()}`);
        return true;
      }
      if (res.status === 401) {
        this._setSyncStatus('local', 'Clave de sincronización incorrecta');
        return false;
      }
      this._setSyncStatus('local', 'No se pudo enviar al servidor');
      return false;
    } catch (err) {
      const msg = err?.message?.includes('frase') ? err.message : 'Cambios guardados solo en este dispositivo';
      this._setSyncStatus(navigator.onLine ? 'local' : 'offline', msg);
      return false;
    }
  },

  async _pullFromServer() {
    try {
      let rawBlob;

      if (this._isSupabase()) {
        rawBlob = await this._pullFromSupabase();
        if (!rawBlob) {
          if (this._hasSubstantialData(this._data)) {
            await this._pushToSupabase(await this._encryptForServer(this._data));
          }
          const enc = this.isEncryptionEnabled();
          const { supabaseUrl } = this.getSyncSettings();
          const host = new URL(supabaseUrl).hostname.replace('.supabase.co', '');
          this._setSyncStatus('synced', `Conectado${enc ? ' 🔒' : ''} a Supabase (${host})`);
          return true;
        }
      } else {
        const res = await this._apiFetch('/api/data');
        if (!res.ok) {
          if (res.status === 401) this._setSyncStatus('local', 'Clave de sincronización incorrecta');
          return false;
        }
        rawBlob = await res.json();
      }

      let serverData;
      try {
        serverData = await this._decryptFromServer(rawBlob);
      } catch (decErr) {
        this._setSyncStatus('local', decErr.message || 'Error al descifrar datos del servidor');
        return false;
      }
      if (!serverData) return false;
      return await this._handleIncomingRemote(serverData, { source: 'poll', silent: true });
    } catch {
      if (!navigator.onLine) this._setSyncStatus('offline', 'Sin conexión');
      return false;
    }
  },

  async _syncNow() {
    if (!this._ready || !navigator.onLine) return;
    if (this.getSyncConflict()) return;

    if (this._localDirty) {
      await this._pushToServer({ force: true, allowOverwrite: true });
      return;
    }

    const remote = await this._fetchRemoteData();
    if (remote) {
      await this._handleIncomingRemote(remote, { source: 'poll', silent: true });
    } else if (this._hasSubstantialData(this._data)) {
      await this._pushToServer({ force: true, allowOverwrite: true });
    } else {
      const enc = this.isEncryptionEnabled();
      if (this._isSupabase()) {
        const { supabaseUrl } = this.getSyncSettings();
        const host = new URL(supabaseUrl).hostname.replace('.supabase.co', '');
        this._setSyncStatus('synced', `Sincronizado${enc ? ' 🔒' : ''} con Supabase (${host})`);
      } else if (this.getSyncSettings().serverUrl) {
        this._setSyncStatus('synced', `Sincronizado${enc ? ' 🔒' : ''} con ${this._apiBase()}`);
      }
    }
  },

  _migrate() {
    const d = this._data;
    if (!d.archives) d.archives = {};
    if (!d.paymentMethods) d.paymentMethods = ['Efectivo', 'Tarjeta', 'Bizum', 'Transferencia'];
    if (!d.budgetConfig) d.budgetConfig = { weeklyIncome: 70, monthlyExtra: 100, categoryLimits: {} };
    if (!d.budgetConfig.categoryLimits) d.budgetConfig.categoryLimits = {};
    if (!d.savingGoals) d.savingGoals = [];
    if (d.roundUpEnabled === undefined) d.roundUpEnabled = true;
    if (!d.totalRoundUpSavings) d.totalRoundUpSavings = 0;
    if (!d.foodBudget && d.foodBudget !== 0) d.foodBudget = 200;
    if (d.checkingBalance === undefined) d.checkingBalance = null;
    if (!d.savingsBalance) d.savingsBalance = 0;
    if (!d.transfers) d.transfers = [];
    if (!d._lastModified) d._lastModified = Date.now();
    if (d.categories.indexOf('Bebida') === -1) d.categories.splice(d.categories.indexOf('Comida') + 1, 0, 'Bebida');
    if (!d.plannedExpenses) d.plannedExpenses = [];
    if (!d.imprevistosBudget && d.imprevistosBudget !== 0) d.imprevistosBudget = 0;
    if (d.categories.indexOf('Imprevisto') === -1) d.categories.push('Imprevisto');
    if (!d.checkingBaseBalance && d.checkingBaseBalance !== 0) d.checkingBaseBalance = 0;
    if (!d.cashBalance && d.cashBalance !== 0) d.cashBalance = 0;
    if (!d.imprevistosSavings && d.imprevistosSavings !== 0) d.imprevistosSavings = 0;
    if (!d.plannedExpensesReserved && d.plannedExpensesReserved !== 0) d.plannedExpensesReserved = 0;
    if (d.lastSavingsWeek === undefined) d.lastSavingsWeek = null;
    if (d.lastPEReserveWeek === undefined) d.lastPEReserveWeek = null;
    if (d.savingsDay === undefined) d.savingsDay = 1;
    if (!d.debts) d.debts = [];
    if (!d.people) d.people = [];
    if (!d.peopleGroups) d.peopleGroups = [];
    if (!d.recurringTransactions) d.recurringTransactions = [];
    if (d.initialCheckingBalance === undefined) d.initialCheckingBalance = 0;
    if (d.initialSavingsBalance === undefined) d.initialSavingsBalance = 0;

    // Food category groups migration
    if (!d.foodCategories || d.foodCategories.length === 0) {
      const defaultFood = ['Comida', 'Bebida', 'Compra Supermercado', 'Comida fuera', 'Cafetería'];
      d.foodCategories = defaultFood.filter(c => d.categories.includes(c) || c === 'Comida' || c === 'Bebida');
      // Also include any category actually used in transactions that looks food-related
      const allCats = new Set([...d.categories, ...Object.values(d.archives || {}).flatMap(txs => txs.map(t => t.category))]);
      for (const cat of allCats) {
        if (!d.foodCategories.includes(cat) &&
            /superm|comida|cafet|restaur|alimenta|bar |bebida|fruter|panade|carnic/i.test(cat)) {
          d.foodCategories.push(cat);
        }
      }
    }

    // Category groups migration — create from foodCategories if not present
    if (!d.categoryGroups) {
      if (d.foodCategories && d.foodCategories.length > 0) {
        d.categoryGroups = [{
          id: 'cgrp_alim',
          name: 'Alimentación',
          categories: [...d.foodCategories],
          monthlyBudget: d.foodBudget || 200,
          isFoodGroup: true,
          color: '#F59E0B',
        }];
      } else {
        d.categoryGroups = [];
      }
    }

    if (!d.expensePriorities || typeof d.expensePriorities !== 'object') {
      d.expensePriorities = {};
    }
    // Seed sensible defaults once (only for missing keys)
    const pri = d.expensePriorities;
    if (pri['__imprevistos__'] == null) pri['__imprevistos__'] = 2;
    for (const g of d.categoryGroups || []) {
      const key = 'group:' + g.id;
      if (pri[key] == null) pri[key] = g.isFoodGroup ? 1 : 3;
    }
    const lowPriCats = ['Salidas', 'Caprichos', 'Ocio', 'Otros', 'Comida fuera', 'Cafetería'];
    const highPriCats = ['Vivienda', 'Salud', 'Transporte', 'Educación'];
    for (const cat of d.categories || []) {
      const key = 'cat:' + cat;
      if (pri[key] != null) continue;
      if (lowPriCats.includes(cat)) pri[key] = 5;
      else if (highPriCats.includes(cat)) pri[key] = 2;
      else if (cat === 'Imprevisto') pri[key] = 2;
      else pri[key] = 3;
    }

    if (!d.incomeGroups) d.incomeGroups = [];

    if (!d.priorityIncludes || typeof d.priorityIncludes !== 'object') {
      d.priorityIncludes = { groups: [], categories: [], customized: false };
    }
    if (!Array.isArray(d.priorityIncludes.groups)) d.priorityIncludes.groups = [];
    if (!Array.isArray(d.priorityIncludes.categories)) d.priorityIncludes.categories = [];
    if (d.priorityIncludes.customized == null) d.priorityIncludes.customized = false;
    this._syncPriorityIncludesAuto();

    if (!d.catalogEmojis || typeof d.catalogEmojis !== 'object') {
      d.catalogEmojis = { category: {}, incomeCategory: {}, type: {}, method: {} };
    }
    for (const k of ['category', 'incomeCategory', 'type', 'method']) {
      if (!d.catalogEmojis[k] || typeof d.catalogEmojis[k] !== 'object') d.catalogEmojis[k] = {};
    }

    if (!d.emojiLibrary || typeof d.emojiLibrary !== 'object') {
      d.emojiLibrary = { custom: [], usage: {} };
    }
    if (!Array.isArray(d.emojiLibrary.custom)) d.emojiLibrary.custom = [];
    if (!d.emojiLibrary.usage || typeof d.emojiLibrary.usage !== 'object') d.emojiLibrary.usage = {};
    if (!d._emojiUsageSeeded) {
      d._emojiUsageSeeded = true;
      this._seedEmojiUsageFromData(d);
    }

    // Migrate legacy "Ahorro" / "Ahorro programado" Gasto → Traspaso (classification only; no balance re-apply)
    if (!d._ahorroToTraspasoMigrated) {
      const convert = (t) => {
        if (t.type !== 'Gasto') return;
        if (t.category !== 'Ahorro' && t.category !== 'Ahorro programado') return;
        const wasProgramado = t.category === 'Ahorro programado';
        t.type = 'Traspaso';
        t.category = 'Traspaso';
        t.transferType = t.transferType || 'to_savings';
        t.paymentMethod = t.paymentMethod || 'Transferencia';
        t.emoji = t.emoji || (wasProgramado ? '📋' : '🐷');
        // Keep _noAutoBalance if already set (balances were updated manually at creation time)
        if (t._noAutoBalance == null) t._noAutoBalance = true;
        if (wasProgramado && !t.description) t.description = 'Reserva gastos planificados';
      };
      for (const t of d.transactions || []) convert(t);
      for (const month of Object.keys(d.archives || {})) {
        for (const t of d.archives[month] || []) convert(t);
      }
      // Remove pseudo-expense categories from the catalog
      d.categories = (d.categories || []).filter(c => c !== 'Ahorro' && c !== 'Ahorro programado');
      d._ahorroToTraspasoMigrated = true;
    }

    if (!d.incomeCategories) d.incomeCategories = ['Mensualidad', 'Paga', 'Extra'];
    const incomeCatNames = ['Mensualidad', 'Paga', 'Extra'];
    for (const name of incomeCatNames) {
      if (!d.incomeCategories.includes(name)) d.incomeCategories.push(name);
    }
    const expenseIncomeCats = ['Mensualidad', 'Paga', 'Extra'];
    d.categories = d.categories.filter(c => !expenseIncomeCats.includes(c));
    for (const t of d.transactions) {
      if (t.type === 'Ingreso' && (t.category === '__add__' || !d.incomeCategories.includes(t.category))) {
        if (expenseIncomeCats.includes(t.category) || t.category === '__add__') {
          t.category = t.description?.toLowerCase().includes('paga') ? 'Paga'
            : t.description?.toLowerCase().includes('extra') ? 'Extra'
            : 'Mensualidad';
        } else if (!d.incomeCategories.includes(t.category)) {
          d.incomeCategories.push(t.category);
        }
      }
    }
    for (const month of Object.keys(d.archives || {})) {
      for (const t of d.archives[month]) {
        if (t.type === 'Ingreso' && (t.category === '__add__' || expenseIncomeCats.includes(t.category))) {
          t.category = t.description?.toLowerCase().includes('paga') ? 'Paga'
            : t.description?.toLowerCase().includes('extra') ? 'Extra'
            : 'Mensualidad';
        }
      }
    }

    // One-time migration: assign `account` to existing transactions and compute initialCheckingBalance
    if (!d._balanceMigrated) {
      for (const t of d.transactions) {
        if (!t.account) {
          t.account = t.paymentMethod === 'Efectivo' ? 'cash' : 'checking';
        }
      }
      // Compute what checkingBalance should be from all tracked transactions
      const computedChecking = d.transactions.reduce((sum, t) => {
        if (t._noAutoBalance) return sum;
        if ((t.account || 'checking') !== 'checking') return sum;
        return sum + (t.type === 'Ingreso' ? t.amount : -t.amount);
      }, 0);
      const computedSavings = d.transactions.reduce((sum, t) => {
        if (t._noAutoBalance) return sum;
        if (t.account !== 'savings') return sum;
        return sum + (t.type === 'Ingreso' ? t.amount : -t.amount);
      }, 0);
      const computedCash = d.transactions.reduce((sum, t) => {
        if (t._noAutoBalance) return sum;
        if (t.account !== 'cash') return sum;
        return sum + (t.type === 'Ingreso' ? t.amount : -t.amount);
      }, 0);
      if (!d.cashBalance && d.cashBalance !== 0) d.cashBalance = Math.max(0, computedCash);
      // initialBalance = currentBalance - what transactions already account for
      if (d.checkingBalance !== null && d.checkingBalance !== undefined) {
        d.initialCheckingBalance = Math.round((d.checkingBalance - computedChecking) * 100) / 100;
      } else {
        d.checkingBalance = 0;
        d.initialCheckingBalance = 0;
      }
      d.initialSavingsBalance = Math.round(((d.savingsBalance || 0) - computedSavings) * 100) / 100;
      d._balanceMigrated = true;
    }

    d.savingGoals = d.savingGoals.map(g => {
      if (!g.targetDate) g.targetDate = '';
      if (!g.priority && g.priority !== 0) g.priority = 0;
      return g;
    });

    this._syncCatalogFromData();
    for (const debt of d.debts || []) {
      if (debt.person) this.rememberPerson(debt.person, false);
    }
  },

  /** Ensures config lists include every value used in movements, deudas, etc. */
  _syncCatalogFromData() {
    const d = this._data;
    const addUnique = (arr, val) => {
      if (!val || val === '__add__' || val === '__ajuste__' || val === 'Traspaso') return;
      if (!arr.includes(val)) arr.push(val);
    };
    const scanTx = (t) => {
      if (!t) return;
      if (t.type === 'Ingreso') addUnique(d.incomeCategories, t.category);
      else if (t.type !== 'Traspaso') addUnique(d.categories, t.category);
      addUnique(d.types, t.type);
      if (t.paymentMethod && t.paymentMethod !== 'Ajuste') addUnique(d.paymentMethods, t.paymentMethod);
    };
    for (const t of d.transactions) scanTx(t);
    for (const txs of Object.values(d.archives || {})) txs.forEach(scanTx);
    for (const r of d.recurringTransactions || []) {
      if (r.category) {
        if (r.type === 'Ingreso') addUnique(d.incomeCategories, r.category);
        else addUnique(d.categories, r.category);
      }
      if (r.type) addUnique(d.types, r.type);
      if (r.paymentMethod) addUnique(d.paymentMethods, r.paymentMethod);
    }
    for (const debt of d.debts || []) {
      if (debt.category) addUnique(d.categories, debt.category);
    }
    addUnique(d.incomeCategories, 'Deuda cobrada');
    addUnique(d.types, 'Ingreso');
    addUnique(d.types, 'Gasto');
    addUnique(d.types, 'Traspaso');
  },

  syncCatalogFromData() {
    this._syncCatalogFromData();
    this._save();
  },

  getCatalogUsage() {
    const usage = {
      category: {}, incomeCategory: {}, type: {}, method: {},
    };
    const bump = (map, key) => { if (key) map[key] = (map[key] || 0) + 1; };
    const scan = (t) => {
      if (!t) return;
      bump(usage.type, t.type);
      if (t.paymentMethod) bump(usage.method, t.paymentMethod);
      if (t.type === 'Ingreso') bump(usage.incomeCategory, t.category);
      else if (t.type !== 'Traspaso' && t.category !== '__ajuste__') bump(usage.category, t.category);
    };
    for (const t of this._data.transactions) scan(t);
    for (const txs of Object.values(this._data.archives || {})) txs.forEach(scan);
    for (const r of this._data.recurringTransactions || []) {
      bump(usage.type, r.type);
      if (r.paymentMethod) bump(usage.method, r.paymentMethod);
      if (r.type === 'Ingreso') bump(usage.incomeCategory, r.category);
      else bump(usage.category, r.category);
    }
    return usage;
  },

  _renameInTransactions(field, oldVal, newVal, filterFn = () => true) {
    for (const t of this._data.transactions) {
      if (filterFn(t) && t[field] === oldVal) t[field] = newVal;
    }
    for (const month of Object.keys(this._data.archives || {})) {
      for (const t of this._data.archives[month]) {
        if (filterFn(t) && t[field] === oldVal) t[field] = newVal;
      }
    }
    for (const r of this._data.recurringTransactions || []) {
      if (r[field] === oldVal) r[field] = newVal;
    }
  },

  _reassignInTransactions(field, oldVal, newVal, filterFn = () => true) {
    this._renameInTransactions(field, oldVal, newVal, filterFn);
  },

  _save({ awaitSync = false, forcePush = false } = {}) {
    this._localDirty = true;
    this._data._lastModified = Date.now();
    const data = this._data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    this._saveCallbacks.forEach(cb => cb());
    const push = this._pushToServer({ force: true, allowOverwrite: true }).then((ok) => {
      if (!ok && typeof App !== 'undefined' && App.showToast) {
        App.showToast('⚡ Cambios guardados solo localmente — sin conexión', 3500);
      }
      return ok;
    });
    return awaitSync ? push : undefined;
  },

  _startSync() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    this._stopRealtimeSync();
    const s = this.getSyncSettings();
    const hasBackend = this._isSupabase() || !!s.serverUrl;
    if (!hasBackend) return;
    if (this._isSupabase()) {
      this._startRealtimeSync();
      this._syncTimer = setInterval(() => this._pullFromServer(), REALTIME_FALLBACK_INTERVAL);
    } else {
      this._syncTimer = setInterval(() => this._pullFromServer(), SYNC_INTERVAL);
    }
  },

  onChange(callback) { this._callbacks.push(callback); },
  /** Called on every local save (localStorage). Use for lightweight UI updates like calendar refresh. */
  onSave(callback) { this._saveCallbacks.push(callback); },

  getData() { return this._data; },
  getTransactions() { return this._data.transactions; },
  getCurrentMonth() { return this._data.currentMonth; },

  setCurrentMonth(month) { this._data.currentMonth = month; this._save(); },

  // ── Balance helpers ───────────────────────────────────────────────────────
  /** Returns which account bucket a transaction belongs to.
   *  Explicit `t.account` wins; falls back to paymentMethod heuristic. */
  _resolveAccount(t) {
    if (t.account) return t.account;
    if (t.paymentMethod === 'Efectivo') return 'cash';
    return 'checking';
  },

  /** Apply the balance effect of transaction `t` multiplied by `sign` (+1 or -1).
   *  Skips transactions flagged `_noAutoBalance` (internal system transfers). */
  _applyBalanceDelta(t, sign) {
    if (t._noAutoBalance) return;
    // Traspaso semántico: dirección depende de transferType
    if (t.type === 'Traspaso') {
      if (this._data.checkingBalance === null) this._data.checkingBalance = this._data.initialCheckingBalance || 0;
      if (t.transferType === 'from_savings_emergency') {
        // Ahorro → Corriente (gasto imprevisto desde ahorro)
        this._data.savingsBalance    = Math.round(((this._data.savingsBalance || 0) - t.amount * sign) * 100) / 100;
        this._data.checkingBalance   = Math.round((this._data.checkingBalance   + t.amount * sign) * 100) / 100;
      } else {
        // Corriente → Ahorro (default: to_savings)
        this._data.checkingBalance   = Math.round((this._data.checkingBalance   - t.amount * sign) * 100) / 100;
        this._data.savingsBalance    = Math.round(((this._data.savingsBalance || 0) + t.amount * sign) * 100) / 100;
      }
      return;
    }
    const account = this._resolveAccount(t);
    const delta = (t.type === 'Ingreso' ? t.amount : -t.amount) * sign;
    if (account === 'cash') {
      this._data.cashBalance = Math.round(((this._data.cashBalance || 0) + delta) * 100) / 100;
    } else if (account === 'checking') {
      if (this._data.checkingBalance === null) this._data.checkingBalance = this._data.initialCheckingBalance || 0;
      this._data.checkingBalance = Math.round((this._data.checkingBalance + delta) * 100) / 100;
    } else if (account === 'savings') {
      this._data.savingsBalance = Math.round(((this._data.savingsBalance || 0) + delta) * 100) / 100;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────

  addTransaction(t) {
    t.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
    t.month = t.date.substring(0, 7);
    if (!t.account) t.account = this._resolveAccount(t);
    if (t.emoji) this.trackEmoji(t.emoji);
    this._applyBalanceDelta(t, 1);
    this._data.transactions.push(t);
    this._save();
    return t;
  },

  updateTransaction(id, updates) {
    const idx = this._data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const old = { ...this._data.transactions[idx] };
    this._applyBalanceDelta(old, -1);              // revert old effect
    const updated = { ...old, ...updates };
    if (!updated.account) updated.account = this._resolveAccount(updated);
    if (updates.date) updated.month = updated.date.substring(0, 7);
    if (updates.emoji !== undefined && updates.emoji) this.trackEmoji(updates.emoji);
    this._applyBalanceDelta(updated, 1);           // apply new effect
    this._data.transactions[idx] = updated;
    this._save();
    return updated;
  },

  deleteTransaction(id) {
    const t = this._data.transactions.find(x => x.id === id);
    if (!t) return;
    const linkedDebt = (this._data.debts || []).find(d => d.linkedTxId === id && !d.isPaid);
    if (linkedDebt) {
      if (linkedDebt.autoCreatedTx) {
        this._data.debts = this._data.debts.filter(d => d.id !== linkedDebt.id);
      } else {
        linkedDebt.linkedTxId = null;
      }
      delete t._debtId;
    }
    this._applyBalanceDelta(t, -1);
    this._data.transactions = this._data.transactions.filter(x => x.id !== id);
    this._save();
  },

  /** Batch import. `applyBalance` controls whether balance is updated for each tx. */
  addTransactions(batch, applyBalance = true) {
    const added = [];
    for (const t of batch) {
      t.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 8) + added.length;
      t.month = t.date.substring(0, 7);
      if (!t.account) t.account = this._resolveAccount(t);
      if (applyBalance) this._applyBalanceDelta(t, 1);
      this._data.transactions.push(t);
      if (t.emoji) this.trackEmoji(t.emoji);
      added.push(t);
    }
    this._save();
    return added;
  },

  /** Creates a balance-adjustment transaction (excluded from budget/stats).
   *  Use to sync the computed balance with the real bank balance. */
  addAdjustmentTransaction(account, targetBalance, note) {
    const current = account === 'checking'
      ? (this._data.checkingBalance ?? 0)
      : account === 'cash'
        ? (this._data.cashBalance ?? 0)
        : (this._data.savingsBalance || 0);
    const diff = Math.round((targetBalance - current) * 100) / 100;
    if (diff === 0) return null;
    const t = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: diff > 0 ? 'Ingreso' : 'Gasto',
      amount: Math.abs(diff),
      category: '__ajuste__',
      description: note || (diff > 0 ? 'Ajuste bancario (+)' : 'Ajuste bancario (-)'),
      paymentMethod: 'Ajuste',
      account,
      _noAutoBalance: false,   // this IS the balance-effect transaction
    };
    this._applyBalanceDelta(t, 1);
    this._data.transactions.push(t);
    this._save();
    return t;
  },

  getInitialCheckingBalance() { return this._data.initialCheckingBalance ?? 0; },
  setInitialCheckingBalance(v) {
    const old = this._data.initialCheckingBalance ?? 0;
    this._data.initialCheckingBalance = v;
    const delta = v - old;
    if (this._data.checkingBalance !== null) {
      this._data.checkingBalance = Math.round((this._data.checkingBalance + delta) * 100) / 100;
    }
    this._save();
  },
  getInitialSavingsBalance() { return this._data.initialSavingsBalance ?? 0; },
  setInitialSavingsBalance(v) {
    const old = this._data.initialSavingsBalance ?? 0;
    this._data.initialSavingsBalance = v;
    const delta = v - old;
    this._data.savingsBalance = Math.round(((this._data.savingsBalance || 0) + delta) * 100) / 100;
    this._save();
  },

  getCategories() { return [...this._data.categories]; },
  getIncomeCategories() { return [...(this._data.incomeCategories || [])]; },
  getCategoriesForType(type) {
    return type === 'Ingreso' ? this.getIncomeCategories() : this.getCategories();
  },

  _catalogEmojiMap(kind) {
    if (!this._data.catalogEmojis) this._data.catalogEmojis = { category: {}, incomeCategory: {}, type: {}, method: {} };
    if (!this._data.catalogEmojis[kind]) this._data.catalogEmojis[kind] = {};
    return this._data.catalogEmojis[kind];
  },

  getCatalogEmoji(kind, name) {
    return this._catalogEmojiMap(kind)[name] || '';
  },

  setCatalogEmoji(kind, name, emoji) {
    const map = this._catalogEmojiMap(kind);
    const v = (emoji || '').trim();
    if (v) {
      map[name] = v;
      this.trackEmoji(v);
    } else delete map[name];
    this._save();
  },

  _ensureEmojiLibrary() {
    if (!this._data.emojiLibrary) this._data.emojiLibrary = { custom: [], usage: {} };
    if (!Array.isArray(this._data.emojiLibrary.custom)) this._data.emojiLibrary.custom = [];
    if (!this._data.emojiLibrary.usage || typeof this._data.emojiLibrary.usage !== 'object') {
      this._data.emojiLibrary.usage = {};
    }
  },

  getEmojiLibrary() {
    this._ensureEmojiLibrary();
    return this._data.emojiLibrary;
  },

  trackEmoji(emoji) {
    if (typeof EmojiUtils === 'undefined') return;
    const e = EmojiUtils.normalize(emoji);
    if (!e) return;
    this._ensureEmojiLibrary();
    const lib = this._data.emojiLibrary;
    lib.usage[e] = (lib.usage[e] || 0) + 1;
    if (!lib.custom.includes(e)) {
      lib.custom.unshift(e);
      if (lib.custom.length > 64) lib.custom.length = 64;
    } else {
      lib.custom.splice(lib.custom.indexOf(e), 1);
      lib.custom.unshift(e);
    }
  },

  _seedEmojiUsageFromData(d) {
    if (typeof EmojiUtils === 'undefined') return;
    const bump = (emoji) => {
      const e = EmojiUtils.normalize(emoji);
      if (!e) return;
      d.emojiLibrary.usage[e] = (d.emojiLibrary.usage[e] || 0) + 1;
      if (!d.emojiLibrary.custom.includes(e)) d.emojiLibrary.custom.push(e);
    };
    const scanTx = (t) => { if (t?.emoji) bump(t.emoji); };
    for (const t of d.transactions || []) scanTx(t);
    for (const txs of Object.values(d.archives || {})) txs.forEach(scanTx);
    for (const g of d.categoryGroups || []) { if (g.emoji) bump(g.emoji); }
    for (const g of d.incomeGroups || []) { if (g.emoji) bump(g.emoji); }
    for (const kind of ['category', 'incomeCategory', 'type', 'method']) {
      for (const emoji of Object.values(d.catalogEmojis?.[kind] || {})) bump(emoji);
    }
    if (d.emojiLibrary.custom.length > 64) d.emojiLibrary.custom = d.emojiLibrary.custom.slice(-64);
  },

  getCatalogDisplayEmoji(kind, name) {
    const stored = this.getCatalogEmoji(kind, name);
    if (stored) return stored;
    return typeof EmojiUtils !== 'undefined' ? EmojiUtils.inferDefault(name, kind) : '🏷️';
  },

  getGroupDisplayEmoji(group, income = false) {
    if (group?.emoji) return group.emoji;
    const kind = income ? 'incomeGroup' : 'expenseGroup';
    if (group?.isFoodGroup) return '🍽️';
    return typeof EmojiUtils !== 'undefined' ? EmojiUtils.inferDefault(group?.name || '', kind) : '📂';
  },

  _moveCatalogEmoji(kind, oldName, newName) {
    const map = this._catalogEmojiMap(kind);
    if (map[oldName]) {
      map[newName] = map[oldName];
      delete map[oldName];
    }
  },

  _deleteCatalogEmoji(kind, name) {
    delete this._catalogEmojiMap(kind)[name];
  },

  addCategory(name) {
    if (!this._data.categories.includes(name)) { this._data.categories.push(name); this._save(); }
  },
  addIncomeCategory(name) {
    if (!this._data.incomeCategories) this._data.incomeCategories = [];
    if (!this._data.incomeCategories.includes(name)) { this._data.incomeCategories.push(name); this._save(); }
  },
  deleteCategory(name) {
    this._data.categories = this._data.categories.filter(c => c !== name);
    this._deleteCatalogEmoji('category', name);
    // Clean up any weekly limit associated with this category
    if (this._data.budgetConfig?.categoryLimits) {
      delete this._data.budgetConfig.categoryLimits[name];
    }
    if (this._data.expensePriorities) delete this._data.expensePriorities['cat:' + name];
    const inc = this.getPriorityIncludes();
    inc.categories = inc.categories.filter(c => c !== name);
    // Remove from category groups
    for (const g of (this._data.categoryGroups || [])) {
      g.categories = g.categories.filter(c => c !== name);
    }
    // Remove from legacy foodCategories
    if (this._data.foodCategories) {
      this._data.foodCategories = this._data.foodCategories.filter(c => c !== name);
    }
    this._save();
  },
  deleteIncomeCategory(name) {
    this._data.incomeCategories = (this._data.incomeCategories || []).filter(c => c !== name);
    this._deleteCatalogEmoji('incomeCategory', name);
    for (const g of (this._data.incomeGroups || [])) {
      g.categories = g.categories.filter(c => c !== name);
    }
    this._save();
  },

  renameCategory(oldName, newName) {
    const cats = this._data.categories;
    const idx = cats.indexOf(oldName);
    if (idx === -1 || cats.includes(newName)) return false;
    cats[idx] = newName;
    // Rename in all transactions
    for (const t of this._data.transactions) {
      if (t.category === oldName) t.category = newName;
    }
    for (const month of Object.keys(this._data.archives || {})) {
      for (const t of this._data.archives[month]) {
        if (t.category === oldName) t.category = newName;
      }
    }
    // Rename limit key if exists
    const limits = this._data.budgetConfig?.categoryLimits;
    if (limits && limits[oldName] !== undefined) {
      limits[newName] = limits[oldName];
      delete limits[oldName];
    }
    // Rename in category groups
    for (const g of (this._data.categoryGroups || [])) {
      const gi = g.categories.indexOf(oldName);
      if (gi !== -1) g.categories[gi] = newName;
    }
    // Rename in legacy foodCategories
    const fi = (this._data.foodCategories || []).indexOf(oldName);
    if (fi !== -1) this._data.foodCategories[fi] = newName;
    this._moveCatalogEmoji('category', oldName, newName);
    this._save();
    return true;
  },

  renameIncomeCategory(oldName, newName) {
    const cats = this._data.incomeCategories || [];
    const idx = cats.indexOf(oldName);
    if (idx === -1 || cats.includes(newName)) return false;
    cats[idx] = newName;
    for (const t of this._data.transactions) {
      if (t.type === 'Ingreso' && t.category === oldName) t.category = newName;
    }
    for (const month of Object.keys(this._data.archives || {})) {
      for (const t of this._data.archives[month]) {
        if (t.type === 'Ingreso' && t.category === oldName) t.category = newName;
      }
    }
    this._moveCatalogEmoji('incomeCategory', oldName, newName);
    this._save();
    return true;
  },

  reassignCategory(oldName, newName, isIncome) {
    for (const t of this._data.transactions) {
      if (t.category === oldName && (isIncome ? t.type === 'Ingreso' : t.type !== 'Ingreso')) {
        t.category = newName;
      }
    }
    for (const month of Object.keys(this._data.archives || {})) {
      for (const t of this._data.archives[month]) {
        if (t.category === oldName && (isIncome ? t.type === 'Ingreso' : t.type !== 'Ingreso')) {
          t.category = newName;
        }
      }
    }
    this._save();
  },

  getTypes() { return [...this._data.types]; },
  addType(name) {
    if (!this._data.types.includes(name)) { this._data.types.push(name); this._save(); }
  },
  deleteType(name) {
    this._data.types = this._data.types.filter(t => t !== name);
    this._deleteCatalogEmoji('type', name);
    this._save();
  },

  renameType(oldName, newName) {
    if (!this._data.types.includes(oldName) || this._data.types.includes(newName)) return false;
    const idx = this._data.types.indexOf(oldName);
    this._data.types[idx] = newName;
    this._renameInTransactions('type', oldName, newName);
    this._moveCatalogEmoji('type', oldName, newName);
    this._save();
    return true;
  },

  reassignType(oldName, newName) {
    this._reassignInTransactions('type', oldName, newName || 'Gasto');
    this._save();
  },

  getPaymentMethods() { return [...this._data.paymentMethods]; },
  addPaymentMethod(name) {
    if (!this._data.paymentMethods.includes(name)) { this._data.paymentMethods.push(name); this._save(); }
  },
  deletePaymentMethod(name) {
    this._data.paymentMethods = this._data.paymentMethods.filter(p => p !== name);
    this._deleteCatalogEmoji('method', name);
    this._save();
  },

  renamePaymentMethod(oldName, newName) {
    if (!this._data.paymentMethods.includes(oldName) || this._data.paymentMethods.includes(newName)) return false;
    const idx = this._data.paymentMethods.indexOf(oldName);
    this._data.paymentMethods[idx] = newName;
    this._renameInTransactions('paymentMethod', oldName, newName);
    this._moveCatalogEmoji('method', oldName, newName);
    this._save();
    return true;
  },

  reassignPaymentMethod(oldName, newName) {
    this._reassignInTransactions('paymentMethod', oldName, newName || 'Tarjeta');
    this._save();
  },

  // ── People & groups ───────────────────────────────────────────────────────
  getPeople() { return [...(this._data.people || [])].sort((a, b) => a.localeCompare(b, 'es')); },

  rememberPerson(name, save = true) {
    const n = (name || '').trim();
    if (!n) return;
    if (!this._data.people) this._data.people = [];
    if (!this._data.people.includes(n)) {
      this._data.people.push(n);
      if (save) this._save();
    }
  },

  addPerson(name) {
    this.rememberPerson(name, true);
  },

  renamePerson(oldName, newName) {
    const n = (newName || '').trim();
    if (!n || oldName === n) return false;
    const idx = (this._data.people || []).indexOf(oldName);
    if (idx === -1) return false;
    if (!this._data.people.includes(n)) this._data.people[idx] = n;
    else this._data.people.splice(idx, 1);
    for (const d of this._data.debts || []) {
      if (d.person === oldName) d.person = n;
    }
    for (const g of this._data.peopleGroups || []) {
      g.members = g.members.map(m => m === oldName ? n : m);
    }
    this._save();
    return true;
  },

  deletePerson(name) {
    this._data.people = (this._data.people || []).filter(p => p !== name);
    for (const g of this._data.peopleGroups || []) {
      g.members = g.members.filter(m => m !== name);
    }
    this._data.peopleGroups = (this._data.peopleGroups || []).filter(g => g.members.length > 0);
    this._save();
  },

  getPeopleGroups() { return [...(this._data.peopleGroups || [])]; },

  addPeopleGroup(name, members = []) {
    const g = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: (name || '').trim(),
      members: [...new Set(members.map(m => m.trim()).filter(Boolean))],
    };
    if (!g.name) return null;
    g.members.forEach(m => this.rememberPerson(m, false));
    if (!this._data.peopleGroups) this._data.peopleGroups = [];
    this._data.peopleGroups.push(g);
    this._save();
    return g;
  },

  updatePeopleGroup(id, updates) {
    const g = (this._data.peopleGroups || []).find(x => x.id === id);
    if (!g) return;
    if (updates.name) g.name = updates.name.trim();
    if (updates.members) {
      g.members = [...new Set(updates.members.map(m => m.trim()).filter(Boolean))];
      g.members.forEach(m => this.rememberPerson(m, false));
    }
    this._save();
  },

  deletePeopleGroup(id) {
    this._data.peopleGroups = (this._data.peopleGroups || []).filter(g => g.id !== id);
    this._save();
  },

  calcSplitAmount(totalAmount, splitCount) {
    const total = parseFloat(totalAmount) || 0;
    const count = Math.max(2, parseInt(splitCount, 10) || 2);
    return Math.round((total / count) * 100) / 100;
  },

  archiveCurrentMonth() {
    this._backup('pre-archive');
    const month = this._data.currentMonth;
    const monthTx = this._data.transactions.filter(t => t.month === month);
    if (monthTx.length > 0) this._data.archives[month] = monthTx;
    this._data.transactions = this._data.transactions.filter(t => t.month !== month);
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m - 1, 1);
    next.setMonth(next.getMonth() + 1);
    this._data.currentMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    this._save();
    return this._data.currentMonth;
  },

  getArchivedMonth(month) { return this._data.archives[month] || []; },
  getArchivedMonths() { return Object.keys(this._data.archives).sort(); },
  getArchives() { return this._data.archives; },

  getBudgetWeeklyIncome() { return this._data.budgetConfig?.weeklyIncome ?? 70; },
  setBudgetWeeklyIncome(v) { this._data.budgetConfig.weeklyIncome = v; this._save(); },

  getBudgetMonthlyExtra() { return this._data.budgetConfig?.monthlyExtra ?? 100; },
  setBudgetMonthlyExtra(v) { this._data.budgetConfig.monthlyExtra = v; this._save(); },

  getCategoryLimits() { return this._data.budgetConfig?.categoryLimits ?? {}; },
  setCategoryLimit(cat, amount) { this._data.budgetConfig.categoryLimits[cat] = amount; this._save(); },
  removeCategoryLimit(cat) { delete this._data.budgetConfig.categoryLimits[cat]; this._save(); },

  getFoodBudget() { return this._data.foodBudget ?? 200; },
  setFoodBudget(v) {
    this._data.foodBudget = v;
    // Also sync to the primary food group budget if it exists
    const foodGroup = (this._data.categoryGroups || []).find(g => g.isFoodGroup);
    if (foodGroup) foodGroup.monthlyBudget = v;
    this._save();
  },

  /** Returns the effective monthly food budget: sum of food groups' budgets, or legacy value */
  getEffectiveFoodBudget() {
    const foodGroups = (this._data.categoryGroups || []).filter(g => g.isFoodGroup);
    if (foodGroups.length > 0) return foodGroups.reduce((s, g) => s + (g.monthlyBudget || 0), 0);
    return this.getFoodBudget();
  },

  getFoodCategories() { return [...(this._data.foodCategories || [])]; },
  setFoodCategories(arr) { this._data.foodCategories = [...arr]; this._save(); },
  isFoodCategory(cat) {
    // Check category groups first
    const groups = this._data.categoryGroups || [];
    if (groups.some(g => g.isFoodGroup && g.categories.includes(cat))) return true;
    // Fall back to legacy foodCategories
    return (this._data.foodCategories || []).includes(cat);
  },
  addFoodCategory(cat) {
    // Add to the primary food group if it exists, else legacy array
    const foodGroup = (this._data.categoryGroups || []).find(g => g.isFoodGroup);
    if (foodGroup) {
      if (!foodGroup.categories.includes(cat)) { foodGroup.categories.push(cat); this._save(); }
      return;
    }
    if (!this._data.foodCategories) this._data.foodCategories = [];
    if (!this._data.foodCategories.includes(cat)) { this._data.foodCategories.push(cat); this._save(); }
  },
  removeFoodCategory(cat) {
    // Remove from food groups
    let changed = false;
    for (const g of (this._data.categoryGroups || [])) {
      if (g.isFoodGroup && g.categories.includes(cat)) {
        g.categories = g.categories.filter(c => c !== cat);
        changed = true;
      }
    }
    if (!changed) {
      if (!this._data.foodCategories) return;
      this._data.foodCategories = this._data.foodCategories.filter(c => c !== cat);
    }
    this._save();
  },

  // ── Category groups ───────────────────────────────────────────────────────
  getCategoryGroups() { return [...(this._data.categoryGroups || [])]; },

  /** Returns the group that contains a given category name, or null */
  getCategoryGroup(categoryName) {
    return (this._data.categoryGroups || []).find(g => g.categories.includes(categoryName)) || null;
  },

  addCategoryGroup(name, opts = {}) {
    const g = {
      id: 'cgrp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: (name || '').trim(),
      categories: [...new Set(opts.categories || [])],
      monthlyBudget: opts.monthlyBudget || 0,
      isFoodGroup: opts.isFoodGroup || false,
      color: opts.color || '#6366F1',
      emoji: opts.emoji || '',
    };
    if (!g.name) return null;
    if (!this._data.categoryGroups) this._data.categoryGroups = [];
    this._data.categoryGroups.push(g);
    if (!this._data.expensePriorities) this._data.expensePriorities = {};
    if (this._data.expensePriorities['group:' + g.id] == null) {
      this._data.expensePriorities['group:' + g.id] = g.isFoodGroup ? 1 : 3;
    }
    if (!this.getPriorityIncludes().customized) {
      this.getPriorityIncludes().groups.push(g.id);
    }
    this._save();
    return g;
  },

  updateCategoryGroup(id, updates) {
    const g = (this._data.categoryGroups || []).find(x => x.id === id);
    if (!g) return;
    if (updates.name !== undefined) g.name = updates.name.trim();
    if (updates.categories !== undefined) g.categories = [...new Set(updates.categories)];
    if (updates.monthlyBudget !== undefined) g.monthlyBudget = updates.monthlyBudget;
    if (updates.isFoodGroup !== undefined) g.isFoodGroup = updates.isFoodGroup;
    if (updates.color !== undefined) g.color = updates.color;
    if (updates.emoji !== undefined) {
      g.emoji = updates.emoji;
      if (updates.emoji) this.trackEmoji(updates.emoji);
    }
    // Sync legacy foodBudget when updating the food group budget
    if (updates.isFoodGroup && updates.monthlyBudget !== undefined) {
      this._data.foodBudget = updates.monthlyBudget;
    }
    this._save();
  },

  deleteCategoryGroup(id) {
    this._data.categoryGroups = (this._data.categoryGroups || []).filter(g => g.id !== id);
    if (this._data.expensePriorities) delete this._data.expensePriorities['group:' + id];
    const inc = this.getPriorityIncludes();
    inc.groups = inc.groups.filter(gid => gid !== id);
    this._save();
  },

  // ── Grupos de ingreso ─────────────────────────────────────────────────────
  getIncomeGroups() { return [...(this._data.incomeGroups || [])]; },

  getIncomeGroup(categoryName) {
    return (this._data.incomeGroups || []).find(g => g.categories.includes(categoryName)) || null;
  },

  addIncomeGroup(name, opts = {}) {
    const g = {
      id: 'igrp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: (name || '').trim(),
      categories: [...new Set(opts.categories || [])],
      monthlyTarget: opts.monthlyTarget || 0,
      color: opts.color || '#10B981',
      emoji: opts.emoji || '',
    };
    if (!g.name) return null;
    if (!this._data.incomeGroups) this._data.incomeGroups = [];
    this._data.incomeGroups.push(g);
    this._save();
    return g;
  },

  updateIncomeGroup(id, updates) {
    const g = (this._data.incomeGroups || []).find(x => x.id === id);
    if (!g) return;
    if (updates.name !== undefined) g.name = updates.name.trim();
    if (updates.categories !== undefined) g.categories = [...new Set(updates.categories)];
    if (updates.monthlyTarget !== undefined) g.monthlyTarget = updates.monthlyTarget;
    if (updates.color !== undefined) g.color = updates.color;
    if (updates.emoji !== undefined) {
      g.emoji = updates.emoji;
      if (updates.emoji) this.trackEmoji(updates.emoji);
    }
    this._save();
  },

  deleteIncomeGroup(id) {
    this._data.incomeGroups = (this._data.incomeGroups || []).filter(g => g.id !== id);
    this._save();
  },

  // ── Prioridades de gasto (1=esencial … 5=recortar primero) ────────────────
  getExpensePriorities() {
    return { ...(this._data.expensePriorities || {}) };
  },

  getExpensePriority(key, fallback = 3) {
    const v = this._data.expensePriorities?.[key];
    if (v == null) return fallback;
    return Math.min(5, Math.max(1, Number(v) || fallback));
  },

  setExpensePriority(key, priority) {
    if (!key) return;
    if (!this._data.expensePriorities) this._data.expensePriorities = {};
    this._data.expensePriorities[key] = Math.min(5, Math.max(1, Number(priority) || 3));
    this._save();
  },

  getGroupPriority(groupId) {
    const g = (this._data.categoryGroups || []).find(x => x.id === groupId);
    return this.getExpensePriority('group:' + groupId, g?.isFoodGroup ? 1 : 3);
  },

  getCategoryPriority(categoryName) {
    const includes = this.getPriorityIncludes();
    if (includes.categories.includes(categoryName)) {
      return this.getExpensePriority('cat:' + categoryName, 3);
    }
    const group = this.getCategoryGroup(categoryName);
    if (group && includes.groups.includes(group.id)) {
      return this.getGroupPriority(group.id);
    }
    if (categoryName === 'Imprevisto') return this.getExpensePriority('__imprevistos__', 2);
    return 3;
  },

  getPriorityIncludes() {
    if (!this._data.priorityIncludes) {
      this._data.priorityIncludes = { groups: [], categories: [], customized: false };
    }
    return this._data.priorityIncludes;
  },

  /** Si el usuario no personalizó, mantener todos los grupos + categorías sueltas */
  _syncPriorityIncludesAuto() {
    const inc = this.getPriorityIncludes();
    if (inc.customized) return;
    const grouped = new Set((this._data.categoryGroups || []).flatMap(g => g.categories));
    inc.groups = (this._data.categoryGroups || []).map(g => g.id);
    inc.categories = (this._data.categories || []).filter(c => !grouped.has(c) && c !== 'Imprevisto');
  },

  _markPriorityIncludesCustomized() {
    this.getPriorityIncludes().customized = true;
    this._save();
  },

  getPriorityCoverage() {
    this._syncPriorityIncludesAuto();
    const inc = this.getPriorityIncludes();
    const allCats = (this._data.categories || []).filter(c => c !== 'Imprevisto');
    const covered = new Set();
    for (const gid of inc.groups) {
      const g = (this._data.categoryGroups || []).find(x => x.id === gid);
      if (g) g.categories.forEach(c => covered.add(c));
    }
    for (const cat of inc.categories) covered.add(cat);
    const missing = allCats.filter(c => !covered.has(c)).map(cat => {
      const group = this.getCategoryGroup(cat);
      return {
        cat,
        group,
        groupIncluded: group ? inc.groups.includes(group.id) : false,
      };
    });
    const availableGroups = (this._data.categoryGroups || []).filter(g => !inc.groups.includes(g.id));
    const availableCategories = allCats.filter(c => !inc.categories.includes(c) && !covered.has(c));
    return { covered, missing, includes: inc, availableGroups, availableCategories };
  },

  addPriorityIncludeGroup(groupId) {
    const inc = this.getPriorityIncludes();
    if (!inc.groups.includes(groupId)) {
      inc.groups.push(groupId);
      const g = (this._data.categoryGroups || []).find(x => x.id === groupId);
      if (g) {
        inc.categories = inc.categories.filter(c => !g.categories.includes(c));
      }
      this._markPriorityIncludesCustomized();
    }
  },

  removePriorityIncludeGroup(groupId) {
    const inc = this.getPriorityIncludes();
    inc.groups = inc.groups.filter(id => id !== groupId);
    this._markPriorityIncludesCustomized();
  },

  addPriorityIncludeCategory(categoryName) {
    const inc = this.getPriorityIncludes();
    if (!inc.categories.includes(categoryName)) {
      inc.categories.push(categoryName);
      this._markPriorityIncludesCustomized();
    }
  },

  removePriorityIncludeCategory(categoryName) {
    const inc = this.getPriorityIncludes();
    inc.categories = inc.categories.filter(c => c !== categoryName);
    this._markPriorityIncludesCustomized();
  },

  includeAllMissingPriorityCategories() {
    const { missing } = this.getPriorityCoverage();
    for (const m of missing) this.addPriorityIncludeCategory(m.cat);
  },

  /** Items configurables en Ajustes → Prioridad de gastos */
  getPriorityConfigItems() {
    this._syncPriorityIncludesAuto();
    const inc = this.getPriorityIncludes();
    const items = [];
    for (const gid of inc.groups) {
      const g = (this._data.categoryGroups || []).find(x => x.id === gid);
      if (!g) continue;
      items.push({
        key: 'group:' + g.id,
        kind: 'group',
        id: g.id,
        name: g.name,
        emoji: this.getGroupDisplayEmoji(g),
        hint: `${g.categories.length ? g.categories.length + ' cat.' : 'Sin categorías'} · ${g.isFoodGroup ? 'Plan comida' : (g.monthlyBudget > 0 ? `${g.monthlyBudget.toFixed(0)}€/mes` : 'Sin presupuesto')}`,
        priority: this.getGroupPriority(g.id),
        removable: true,
      });
    }
    items.push({
      key: '__imprevistos__',
      kind: 'system',
      id: '__imprevistos__',
      name: 'Imprevistos',
      emoji: '⚠️',
      hint: `${(this.getImprevistosBudget() || 0).toFixed(0)}€/mes`,
      priority: this.getExpensePriority('__imprevistos__', 2),
      removable: false,
    });
    const limits = this.getCategoryLimits();
    for (const cat of inc.categories) {
      if (!(this._data.categories || []).includes(cat)) continue;
      const hasLimit = (limits[cat] || 0) > 0;
      const inGroup = this.getCategoryGroup(cat);
      items.push({
        key: 'cat:' + cat,
        kind: 'category',
        id: cat,
        name: cat,
        emoji: this.getCatalogDisplayEmoji('category', cat),
        hint: `${hasLimit ? `Límite ${limits[cat].toFixed(0)}€/sem` : 'Sin límite semanal'}${inGroup ? ` · también en grupo ${inGroup.name}` : ''}`,
        priority: this.getExpensePriority('cat:' + cat, 3),
        removable: true,
      });
    }
    items.sort((a, b) => {
      const order = { group: 0, category: 1, system: 2 };
      const ka = order[a.kind] ?? 1;
      const kb = order[b.kind] ?? 1;
      if (ka !== kb) return ka - kb;
      return a.priority - b.priority || a.name.localeCompare(b.name, 'es');
    });
    return items;
  },

  /** Returns true for internal accounting transactions that should NOT count as spendable expense */
  isInternalTx(t) {
    return !!(t._noAutoBalance || t.category === '__ajuste__' || t.type === 'Traspaso');
  },

  /** Canonical "real spendable expense" filter — use this everywhere for budget calculations */
  isSpendableExpense(t) {
    return t.type === 'Gasto' && !this.isInternalTx(t) && !t._debtPending;
  },

  getImprevistosBudget() { return this._data.imprevistosBudget ?? 0; },
  setImprevistosBudget(v) { this._data.imprevistosBudget = v; this._save(); },
  getImprevistosMonthlySpent() {
    const month = this.getCurrentMonth();
    return this.getTransactions().filter(t => t.month === month && t.category === 'Imprevisto').reduce((s, t) => s + t.amount, 0);
  },
  getImprevistosSavings() { return this._data.imprevistosSavings ?? 0; },
  setImprevistosSavings(v) { this._data.imprevistosSavings = Math.max(0, v); this._save(); },
  addUnusedImprevistosToSavings() {
    const budget = this.getImprevistosBudget();
    const spent = this.getImprevistosMonthlySpent();
    const unused = Math.max(0, budget - spent);
    if (unused <= 0) return 0;
    this._data.imprevistosSavings = (this._data.imprevistosSavings || 0) + unused;
    this._save();
    return unused;
  },
  transferImprevistosToCheckingBase(amount) {
    const available = this._data.imprevistosSavings || 0;
    const actual = Math.min(amount, available);
    if (actual <= 0) return 0;
    this._data.imprevistosSavings = available - actual;
    this._data.checkingBaseBalance = (this._data.checkingBaseBalance || 0) + actual;
    this._data.checkingBalance = this._data.checkingBalance !== null ? this._data.checkingBalance + actual : null;
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: 'Ingreso', category: 'Ahorro',
      amount: actual,
      description: 'Imprevistos → base cuenta corriente',
      paymentMethod: 'Transferencia',
      account: 'checking',
      _noAutoBalance: true,
    };
    this._data.transactions.push(tx);
    this._save();
    return actual;
  },

  distributeImprevistosSavings(amount) {
    const goals = this.getSavingGoals();
    const active = goals.filter(g => g.currentAmount < g.targetAmount);
    if (active.length === 0 || amount <= 0) return 0;
    const available = this._data.imprevistosSavings || 0;
    const actual = Math.min(amount, available);
    if (actual <= 0) return 0;
    this._data.imprevistosSavings = available - actual;
    this._data.savingsBalance = (this._data.savingsBalance || 0) + actual;
    const totalRemaining = active.reduce((s, g) => s + (g.targetAmount - g.currentAmount), 0);
    let distributed = 0;
    for (let i = 0; i < active.length; i++) {
      const g = active[i];
      const remaining = g.targetAmount - g.currentAmount;
      const proportion = remaining / totalRemaining;
      let contrib = i < active.length - 1 ? Math.round(actual * proportion * 100) / 100 : actual - distributed;
      contrib = Math.min(contrib, remaining);
      const goal = this._data.savingGoals.find(x => x.id === g.id);
      if (goal) goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + contrib);
      distributed += contrib;
    }
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: 'Ingreso', category: 'Ahorro',
      amount: actual,
      description: 'Ahorro desde reserva imprevistos',
      paymentMethod: 'Transferencia',
      account: 'savings',
      _noAutoBalance: true,
    };
    this._data.transactions.push(tx);
    this._save();
    return actual;
  },

  getPlannedExpensesWeeklyNeed() {
    const now = new Date();
    let total = 0;
    for (const p of (this._data.plannedExpenses || [])) {
      const remaining = p.amount - (p.savedSoFar || 0);
      if (remaining <= 0) continue;
      const tgt = new Date(p.targetDate + 'T23:59:59');
      const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
      total += remaining / weeksLeft;
    }
    return total;
  },

  getCashBalance() { return this._data.cashBalance ?? 0; },
  setCashBalance(v) { this._data.cashBalance = v; this._save(); },
  getCheckingBalance() { return this._data.checkingBalance; },
  setCheckingBalance(v) { this._data.checkingBalance = v; this._save(); },
  getCheckingBaseBalance() { return this._data.checkingBaseBalance ?? 0; },
  setCheckingBaseBalance(v) { this._data.checkingBaseBalance = v; this._save(); },
  getSavingsBalance() { return this._data.savingsBalance || 0; },
  setSavingsBalance(v) { this._data.savingsBalance = v; this._save(); },
  getTransfers() { return [...(this._data.transfers || [])]; },

  /**
   * Traspaso global entre cuentas (misma forma que Movimientos / Calendario).
   * Actualiza saldos vía _applyBalanceDelta. Opcionalmente registra en transfers[].
   */
  createAccountTransfer({
    amount,
    description,
    transferType = 'to_savings',
    date,
    logNote,
    emoji,
    skipTransferLog = false,
  } = {}) {
    const amt = Number(amount);
    if (!amt || amt <= 0) return null;
    const dateStr = date || new Date().toISOString().split('T')[0];
    const isEmergency = transferType === 'from_savings_emergency';
    const checking = this.getCheckingBalance();
    const savings = this.getSavingsBalance();
    if (!isEmergency && checking !== null && checking < amt) return -1;
    if (isEmergency && savings < amt) return -1;

    const tx = this.addTransaction({
      date: dateStr,
      amount: amt,
      description: description || (isEmergency ? 'Gasto de ahorro (imprevisto)' : 'Traspaso a ahorro'),
      type: 'Traspaso',
      category: 'Traspaso',
      paymentMethod: 'Transferencia',
      account: 'checking',
      transferType,
      emoji: emoji || (isEmergency ? '🆘' : '🐷'),
    });

    if (!skipTransferLog && !isEmergency) {
      if (!this._data.transfers) this._data.transfers = [];
      this._data.transfers.push({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        date: dateStr,
        amount: amt,
        note: logNote || description || '',
        month: dateStr.substring(0, 7),
        txId: tx.id,
      });
      this._save();
    }
    return tx;
  },

  addTransfer(amount, note) {
    const result = this.createAccountTransfer({
      amount,
      description: note || 'Traspaso a ahorro',
      logNote: note || '',
      transferType: 'to_savings',
    });
    if (result === -1 || !result) return null;
    const log = (this._data.transfers || []).find(t => t.txId === result.id);
    return log || { id: result.id, date: result.date, amount, note: note || '', month: result.month };
  },

  deleteTransfer(id) {
    const t = this._data.transfers.find(x => x.id === id);
    if (t) {
      if (t.txId) {
        const tx = this._data.transactions.find(x => x.id === t.txId);
        if (tx) this.deleteTransaction(t.txId);
        else {
          // Log huérfano: revertir saldos a mano
          this._data.savingsBalance = Math.max(0, (this._data.savingsBalance || 0) - t.amount);
          if (this._data.checkingBalance !== null) {
            this._data.checkingBalance = Math.round(((this._data.checkingBalance || 0) + t.amount) * 100) / 100;
          }
        }
      } else {
        // Legacy (antes de Traspaso global): solo tocaba ahorro; también devolver a corriente
        this._data.savingsBalance = Math.max(0, (this._data.savingsBalance || 0) - t.amount);
        if (this._data.checkingBalance !== null) {
          this._data.checkingBalance = Math.round(((this._data.checkingBalance || 0) + t.amount) * 100) / 100;
        }
      }
    }
    this._data.transfers = this._data.transfers.filter(x => x.id !== id);
    this._save();
  },

  getSavingGoals() { return [...(this._data.savingGoals || [])]; },
  addSavingGoal(name, targetAmount, targetDate, priority) {
    const g = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name,
      targetAmount,
      currentAmount: 0,
      targetDate: targetDate || '',
      priority: priority ?? this._data.savingGoals.length,
      createdAt: new Date().toISOString(),
    };
    this._data.savingGoals.push(g);
    this._save();
    return g;
  },
  updateSavingGoal(id, updates) {
    const idx = this._data.savingGoals.findIndex(g => g.id === id);
    if (idx === -1) return null;
    this._data.savingGoals[idx] = { ...this._data.savingGoals[idx], ...updates };
    this._save();
    return this._data.savingGoals[idx];
  },
  deleteSavingGoal(id) {
    this._data.savingGoals = this._data.savingGoals.filter(g => g.id !== id);
    if (this._data.roundUpGoalId === id) this._data.roundUpGoalId = null;
    this._save();
  },
  contributeToGoal(id, amount) {
    const g = this._data.savingGoals.find(g => g.id === id);
    if (!g) return;
    g.currentAmount = Math.min(g.targetAmount, g.currentAmount + amount);
    this._save();
  },
  getRecommendedWeeklySaving(goals) {
    if (!goals) goals = this.getSavingGoals();
    let total = 0;
    const now = new Date();
    for (const g of goals) {
      if (g.currentAmount >= g.targetAmount) continue;
      const remaining = g.targetAmount - g.currentAmount;
      if (g.targetDate) {
        const targetDate = new Date(g.targetDate + 'T23:59:59');
        const weeksLeft = Math.max(1, (targetDate - now) / (7 * 86400000));
        total += remaining / weeksLeft;
      } else {
        total += remaining / 52;
      }
    }
    return total;
  },
  distributeWeeklySavings() {
    const goals = this.getSavingGoals();
    const now = new Date();
    const active = goals.filter(g => g.currentAmount < g.targetAmount);
    if (active.length === 0) return 0;
    const totalWeekly = this.getRecommendedWeeklySaving(goals);
    if (totalWeekly <= 0) return 0;
    const result = this.createAccountTransfer({
      amount: totalWeekly,
      description: 'Ahorro semanal distribuido a metas',
      logNote: 'Ahorro semanal',
      transferType: 'to_savings',
      emoji: '🐷',
    });
    if (result === -1) return -1;
    if (!result) return 0;
    for (const g of active) {
      const remaining = g.targetAmount - g.currentAmount;
      let need = 0;
      if (g.targetDate) {
        const tgtDate = new Date(g.targetDate + 'T23:59:59');
        const weeksLeft = Math.max(1, (tgtDate - now) / (7 * 86400000));
        need = remaining / weeksLeft;
      } else {
        need = remaining / 52;
      }
      const contribution = Math.min(remaining, Math.max(1, Math.round((need / totalWeekly) * totalWeekly)));
      const goal = this._data.savingGoals.find(x => x.id === g.id);
      if (goal) goal.currentAmount = Math.min(goal.targetAmount, goal.currentAmount + contribution);
    }
    this._save();
    return totalWeekly;
  },
  isRoundUpEnabled() { return this._data.roundUpEnabled !== false; },
  toggleRoundUp() { this._data.roundUpEnabled = !this.isRoundUpEnabled(); this._save(); return this._data.roundUpEnabled; },
  getRoundUpGoalId() { return this._data.roundUpGoalId; },
  setRoundUpGoalId(id) { this._data.roundUpGoalId = id; this._save(); },
  getTotalRoundUpSavings() { return this._data.totalRoundUpSavings || 0; },
  addRoundUp(amount) {
    this._data.totalRoundUpSavings = (this._data.totalRoundUpSavings || 0) + amount;
    if (this._data.roundUpGoalId) {
      this.contributeToGoal(this._data.roundUpGoalId, amount);
    }
    this._save();
  },

  getLastSavingsWeek() { return this._data.lastSavingsWeek; },
  setLastSavingsWeek(w) { this._data.lastSavingsWeek = w; this._save(); },
  getLastPEReserveWeek() { return this._data.lastPEReserveWeek; },
  setLastPEReserveWeek(w) { this._data.lastPEReserveWeek = w; this._save(); },
  getSavingsDay() { return this._data.savingsDay ?? 1; },
  setSavingsDay(d) { this._data.savingsDay = d; this._save(); },

  getPlannedExpenses() { return [...(this._data.plannedExpenses || [])]; },
  addPlannedExpense(name, amount, targetDate) {
    const p = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name, amount, targetDate, savedSoFar: 0,
      createdAt: new Date().toISOString(),
    };
    this._data.plannedExpenses.push(p);
    this._save();
    return p;
  },
  updatePlannedExpense(id, updates) {
    const idx = this._data.plannedExpenses.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this._data.plannedExpenses[idx] = { ...this._data.plannedExpenses[idx], ...updates };
    this._save();
    return this._data.plannedExpenses[idx];
  },
  deletePlannedExpense(id) {
    this._data.plannedExpenses = this._data.plannedExpenses.filter(p => p.id !== id);
    this._save();
  },
  getPlannedExpensesReserved() { return this._data.plannedExpensesReserved ?? 0; },
  reservePlannedExpensesWeekly() {
    const planned = this._data.plannedExpenses || [];
    const now = new Date();
    const active = planned.filter(p => {
      const remaining = p.amount - (p.savedSoFar || 0);
      if (remaining <= 0) return false;
      const tgt = new Date(p.targetDate + 'T23:59:59');
      return tgt > now;
    });
    if (active.length === 0) return 0;
    let totalWeekly = 0;
    for (const p of active) {
      const remaining = p.amount - (p.savedSoFar || 0);
      const tgt = new Date(p.targetDate + 'T23:59:59');
      const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
      totalWeekly += remaining / weeksLeft;
    }
    if (totalWeekly <= 0) return 0;
    const result = this.createAccountTransfer({
      amount: totalWeekly,
      description: 'Reserva semanal para gastos planificados',
      logNote: 'Ahorro programado',
      transferType: 'to_savings',
      emoji: '📋',
    });
    if (result === -1) return -1;
    if (!result) return 0;
    this._data.plannedExpensesReserved = (this._data.plannedExpensesReserved || 0) + totalWeekly;
    for (const p of active) {
      const remaining = p.amount - (p.savedSoFar || 0);
      const tgt = new Date(p.targetDate + 'T23:59:59');
      const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
      const need = remaining / weeksLeft;
      const plannedItem = this._data.plannedExpenses.find(x => x.id === p.id);
      if (plannedItem) plannedItem.savedSoFar = Math.min(p.amount, (plannedItem.savedSoFar || 0) + need);
    }
    this._save();
    return totalWeekly;
  },

  getPinCode() { return this._data.pinCode; },
  setPinCode(code) { this._data.pinCode = code; this._save(); },
  clearPinCode() { this._data.pinCode = null; this._save(); },

  _backup(label) {
    try {
      localStorage.setItem(BACKUP_KEY + '_' + label, JSON.stringify(this._data));
    } catch {}
  },

  maybeBackupAfterUpdate() {
    const running = document.querySelector('meta[name="app-cache-version"]')?.content
      || window.__APP_CACHE_VERSION || '';
    const prev = localStorage.getItem('_appLastRunningVersion');
    if (this._hasSubstantialData(this._data)) {
      this._backup('pre-update-auto');
    }
    if (running && prev && running !== prev && this._hasSubstantialData(this._data)) {
      this._backup('pre-update-' + running.replace(/[^\w-]/g, ''));
    }
    if (running) localStorage.setItem('_appLastRunningVersion', running);
  },

  getDebts() { return [...(this._data.debts || [])]; },
  getPendingDebts()  { return this.getDebts().filter(d => !d.isPaid); },
  getSettledDebts()  { return this.getDebts().filter(d => d.isPaid); },
  getPendingOwedToMe() { return this.getPendingDebts().filter(d => (d.type || 'owed_to_me') === 'owed_to_me'); },
  getPendingIOwe()     { return this.getPendingDebts().filter(d => d.type === 'i_owe'); },

  getDebtByLinkedTx(txId) {
    return (this._data.debts || []).find(d => d.linkedTxId === txId && !d.isPaid) || null;
  },

  getDebtsByLinkedTx(txId) {
    return (this._data.debts || []).filter(d => d.linkedTxId === txId && !d.isPaid);
  },

  getDebtById(id) {
    return (this._data.debts || []).find(d => d.id === id) || null;
  },

  _createDebtTransaction(debt, opts = {}) {
    const isOwedToMe = (debt.type || 'owed_to_me') === 'owed_to_me';
    const txAmount = opts.txAmount || debt.totalAmount || debt.amount;
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: debt.date || new Date().toISOString().split('T')[0],
      month: (debt.date || new Date().toISOString().split('T')[0]).substring(0, 7),
      type: opts.type || 'Gasto',
      category: debt.category || 'Otros',
      amount: txAmount,
      description: debt.description || (isOwedToMe
        ? `Gasto pagado por mí (${debt.person} me debe)`
        : `Debo a ${debt.person}`),
      paymentMethod: opts.paymentMethod || 'Bizum',
      account: opts.account || 'checking',
      _debtId: debt.id,
    };
    if (opts._debtPending) tx._debtPending = true;
    if (opts._noAutoBalance) tx._noAutoBalance = true;
    if (!tx._noAutoBalance) this._applyBalanceDelta(tx, 1);
    this._data.transactions.push(tx);
    return tx;
  },

  _syncDebtToLinkedTx(debt) {
    if (!debt.linkedTxId || !debt.autoCreatedTx) return;
    const tx = this._data.transactions.find(t => t.id === debt.linkedTxId);
    if (!tx || tx._debtId !== debt.id) return;
    const isOwedToMe = (debt.type || 'owed_to_me') === 'owed_to_me';
    this._applyBalanceDelta(tx, -1);
    tx.amount = debt.amount;
    tx.date = debt.date || tx.date;
    tx.month = tx.date.substring(0, 7);
    tx.category = debt.category || tx.category;
    tx.description = debt.description || (isOwedToMe
      ? `Gasto pagado por mí (${debt.person} me debe)`
      : `Debo a ${debt.person}`);
    if (!tx._noAutoBalance) this._applyBalanceDelta(tx, 1);
  },

  addDebt(data) {
    // Accepts object: { person, amount, description, type, category, date, linkedTxId, skipAutoTx }
    // Or legacy (person, amount, description) for backward compat
    let d;
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      d = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        person: data.person || '',
        amount: data.amount,
        description: data.description || '',
        date: data.date || new Date().toISOString().split('T')[0],
        type: data.type || 'owed_to_me',
        category: data.category || 'Otros',
        isPaid: false, paidDate: null, paidTxId: null,
        linkedTxId: data.linkedTxId || null,
        autoCreatedTx: false,
        splitCount: data.splitCount || null,
        totalAmount: data.totalAmount || null,
        splitGroupId: data.splitGroupId || null,
        splitLines: data.splitLines || null,
      };
    } else {
      const [person, amount, description] = arguments;
      d = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
        person: person || '', amount, description: description || '',
        date: new Date().toISOString().split('T')[0],
        type: 'owed_to_me', category: 'Otros',
        isPaid: false, paidDate: null, paidTxId: null, linkedTxId: null,
        autoCreatedTx: false,
      };
      data = { skipAutoTx: false };
    }

    if (d.linkedTxId) {
      const linked = this._data.transactions.find(t => t.id === d.linkedTxId);
      if (linked) linked._debtId = d.id;
    } else if (!data.skipAutoTx) {
      if (d.type === 'owed_to_me') {
        const tx = this._createDebtTransaction(d, { type: 'Gasto' });
        d.linkedTxId = tx.id;
        d.autoCreatedTx = true;
      } else if (d.type === 'i_owe') {
        const tx = this._createDebtTransaction(d, {
          type: 'Gasto', _debtPending: true, _noAutoBalance: true,
        });
        d.linkedTxId = tx.id;
        d.autoCreatedTx = true;
      }
    }

    this._data.debts.push(d);
    if (d.person) this.rememberPerson(d.person, false);
    this._save();
    return d;
  },

  /** Create one debt per person. Supports equal split or per-person custom amounts (splitLines mode). */
  addDebtsForPeople({ persons, amount, amountsByPerson, totalAmount, splitCount, splitLines, type, description, category, date, linkedTxId, skipAutoTx }) {
    const people = [...new Set((persons || []).map(p => p.trim()).filter(Boolean))];
    if (people.length === 0) return [];
    const count = Math.max(people.length + 1, parseInt(splitCount, 10) || 2);

    let share;
    if (!amountsByPerson) {
      share = (amount > 0 ? amount : null) || this.calcSplitAmount(totalAmount, count);
      if (!share || share <= 0) return [];
    }

    const groupId = people.length > 1 ? Date.now().toString(36) + Math.random().toString(36).substr(2, 6) : null;
    const created = [];
    const linkOnce = linkedTxId;
    let first = true;
    for (const person of people) {
      const personAmount = amountsByPerson ? amountsByPerson[person] : share;
      // In itemized mode, skip people who owe nothing
      if (amountsByPerson && (!personAmount || personAmount <= 0)) continue;
      const debt = this.addDebt({
        person, amount: personAmount, type, description, category, date,
        linkedTxId: linkOnce,
        skipAutoTx: skipAutoTx || !!linkOnce || !first,
        splitCount: count,
        totalAmount,
        splitGroupId: groupId,
        splitLines: splitLines || null,
      });
      created.push(debt);
      first = false;
    }
    return created;
  },

  linkDebtsToTransaction(txId, debtPayload) {
    const { persons, person, totalAmount, splitCount, ...rest } = debtPayload;
    if (persons && persons.length > 0) {
      return this.addDebtsForPeople({
        persons, totalAmount, splitCount, ...rest,
        linkedTxId: txId, skipAutoTx: true,
      });
    }
    const debt = this.linkDebtToTransaction(txId, {
      person, amount: rest.amount, ...rest,
      splitCount, totalAmount,
    });
    return debt ? [debt] : [];
  },

  linkDebtToTransaction(txId, debtData) {
    const tx = this._data.transactions.find(t => t.id === txId);
    if (!tx) return null;
    const existing = this.getDebtByLinkedTx(txId);
    if (existing) {
      this.updateDebt(existing.id, debtData);
      return existing;
    }
    return this.addDebt({ ...debtData, linkedTxId: txId, skipAutoTx: true });
  },

  updateDebt(id, updates) {
    const d = this._data.debts.find(x => x.id === id);
    if (d) {
      Object.assign(d, updates);
      if (updates.person) this.rememberPerson(updates.person, false);
      this._syncDebtToLinkedTx(d);
      if (d.linkedTxId) {
        const tx = this._data.transactions.find(t => t.id === d.linkedTxId);
        if (tx) tx._debtId = d.id;
      }
      this._save();
    }
  },

  deleteDebt(id) {
    const debt = this._data.debts.find(d => d.id === id);
    if (debt?.autoCreatedTx && debt.linkedTxId) {
      const tx = this._data.transactions.find(t => t.id === debt.linkedTxId);
      if (tx && tx._debtId === id) {
        this._applyBalanceDelta(tx, -1);
        this._data.transactions = this._data.transactions.filter(t => t.id !== debt.linkedTxId);
      }
    } else if (debt?.linkedTxId) {
      const tx = this._data.transactions.find(t => t.id === debt.linkedTxId);
      if (tx && tx._debtId === id) delete tx._debtId;
    }
    this._data.debts = this._data.debts.filter(d => d.id !== id);
    this._save();
  },

  /** Settle a debt. Creates the appropriate transaction automatically. */
  settleDebt(id) {
    const debt = this._data.debts.find(d => d.id === id);
    if (!debt || debt.isPaid) return null;
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    const isOwedToMe = (debt.type || 'owed_to_me') === 'owed_to_me';

    if (!isOwedToMe && debt.linkedTxId && debt.autoCreatedTx) {
      const pending = this._data.transactions.find(t => t.id === debt.linkedTxId);
      if (pending && pending._debtPending) {
        delete pending._debtPending;
        delete pending._noAutoBalance;
        pending.description = `Pago a ${debt.person}${debt.description ? ': ' + debt.description : ''}`;
        this._applyBalanceDelta(pending, 1);
        debt.isPaid = true;
        debt.paidDate = today;
        debt.paidTxId = pending.id;
        this._save();
        return pending;
      }
    }

    debt.isPaid = true;
    debt.paidDate = today;

    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: today, month,
      type: isOwedToMe ? 'Ingreso' : 'Gasto',
      category: isOwedToMe ? 'Deuda cobrada' : (debt.category || 'Otros'),
      amount: debt.amount,
      description: isOwedToMe
        ? `Cobrado a ${debt.person}${debt.description ? ': ' + debt.description : ''}`
        : `Pago a ${debt.person}${debt.description ? ': ' + debt.description : ''}`,
      paymentMethod: 'Bizum',
      account: 'checking',
      _debtId: id,
    };
    this._applyBalanceDelta(tx, 1);
    this._data.transactions.push(tx);
    debt.paidTxId = tx.id;
    this._save();
    return tx;
  },

  /** Legacy payDebt kept for any existing calls */
  payDebt(id) { return this.settleDebt(id); },

  /**
   * Calcula el balance neto con una persona.
   * Positivo: me deben. Negativo: les debo. Cero: a mano.
   */
  getNetBalance(person) {
    const pending = this.getPendingDebts().filter(d => d.person === person);
    const owedToMe = pending.filter(d => (d.type || 'owed_to_me') === 'owed_to_me').reduce((s, d) => s + d.amount, 0);
    const iOwe     = pending.filter(d => d.type === 'i_owe').reduce((s, d) => s + d.amount, 0);
    return Math.round((owedToMe - iOwe) * 100) / 100;
  },

  /**
   * Liquida todas las deudas pendientes con una persona creando un único movimiento
   * por el importe neto. Estilo Tricount.
   * - net > 0: esa persona me paga la diferencia → Ingreso
   * - net < 0: yo pago la diferencia → Gasto
   * - net == 0: marca todo como liquidado sin movimiento de dinero
   */
  settlePersonNet(person) {
    const pending = this.getPendingDebts().filter(d => d.person === person);
    if (pending.length === 0) return null;
    const net = this.getNetBalance(person);
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    let tx = null;

    if (Math.abs(net) >= 0.01) {
      const isIncome = net > 0;
      tx = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
        date: today, month,
        type: isIncome ? 'Ingreso' : 'Gasto',
        category: isIncome ? 'Deuda cobrada' : (pending.find(d => d.type === 'i_owe')?.category || 'Otros'),
        amount: Math.abs(net),
        description: isIncome
          ? `Saldo neto cobrado a ${person}`
          : `Saldo neto pagado a ${person}`,
        paymentMethod: 'Bizum',
        account: 'checking',
      };
      this._applyBalanceDelta(tx, 1);
      this._data.transactions.push(tx);
    }

    // Marcar todas las deudas pendientes como liquidadas
    for (const d of pending) {
      d.isPaid = true;
      d.paidDate = today;
      d.paidTxId = tx ? tx.id : null;
    }
    this._save();
    return tx;
  },

  // ── Shared space — settings ────────────────────────────────────────────────

  getSharedSyncSettings() {
    try {
      const raw = localStorage.getItem(SHARED_SYNC_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { supabaseUrl: '', supabaseAnonKey: '', rowId: '', passphrase: '' };
  },

  setSharedSyncSettings({ supabaseUrl = '', supabaseAnonKey = '', rowId = '', passphrase = '' } = {}) {
    const obj = {
      supabaseUrl: this._normalizeSupabaseUrl(supabaseUrl),
      supabaseAnonKey: supabaseAnonKey.trim(),
      rowId: rowId.trim() || 'compartido',
      passphrase,
    };
    localStorage.setItem(SHARED_SYNC_KEY, JSON.stringify(obj));
    this._initShared();
  },

  isSharedEnabled() {
    const s = this.getSharedSyncSettings();
    return !!(s.rowId && s.passphrase && s.supabaseUrl && s.supabaseAnonKey);
  },

  onSharedChange(cb) { this._sharedCallbacks.push(cb); },

  // ── Shared space — Supabase client ─────────────────────────────────────────

  _getSharedClient() {
    const s = this.getSharedSyncSettings();
    // Use personal Supabase project if not overridden in shared settings
    const url = s.supabaseUrl || this.getSyncSettings().supabaseUrl;
    const key = s.supabaseAnonKey || this.getSyncSettings().supabaseAnonKey;
    return window.supabase.createClient(url, key);
  },

  // ── Shared space — encryption (same AES-256, shared passphrase) ────────────

  async _encryptShared(obj) {
    const { passphrase } = this.getSharedSyncSettings();
    if (!passphrase || typeof CryptoE2E === 'undefined') return obj;
    const payload = await CryptoE2E.encrypt(JSON.stringify(obj), passphrase);
    payload._lastModified = obj._lastModified || Date.now();
    payload._encrypted = true;
    return payload;
  },

  async _decryptShared(blob) {
    if (!blob || !blob._encrypted) return blob;
    const { passphrase } = this.getSharedSyncSettings();
    if (!passphrase) throw new Error('Datos compartidos cifrados pero no hay frase configurada.');
    const plain = await CryptoE2E.decrypt(blob, passphrase);
    return JSON.parse(plain);
  },

  // ── Shared space — Supabase push/pull ──────────────────────────────────────

  async _pushSharedToSupabase() {
    if (!this.isSharedEnabled()) return false;
    try {
      const { rowId } = this.getSharedSyncSettings();
      const blob = await this._encryptShared(this._sharedData);
      const { error } = await this._getSharedClient()
        .from('sync_data')
        .upsert({ id: rowId, payload: blob });
      return !error;
    } catch { return false; }
  },

  async _pullSharedFromSupabase() {
    if (!this.isSharedEnabled()) return false;
    try {
      const { rowId } = this.getSharedSyncSettings();
      const { data, error } = await this._getSharedClient()
        .from('sync_data')
        .select('payload')
        .eq('id', rowId)
        .maybeSingle();
      if (error) return false;
      if (!data) {
        // First time — push our local shared data
        await this._pushSharedToSupabase();
        return true;
      }
      const remote = await this._decryptShared(data.payload);
      if (!remote) return false;
      if ((remote._lastModified || 0) > (this._sharedData._lastModified || 0)) {
        this._sharedData = remote;
        if (!this._sharedData.debts) this._sharedData.debts = [];
        localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(this._sharedData));
        this._sharedCallbacks.forEach(cb => cb());
      }
      return true;
    } catch { return false; }
  },

  // ── Shared space — init ────────────────────────────────────────────────────

  async _initShared() {
    if (this._sharedTimer) { clearInterval(this._sharedTimer); this._sharedTimer = null; }
    if (!this.isSharedEnabled()) return;

    // Load local cache first
    try {
      const raw = localStorage.getItem(SHARED_STORAGE_KEY);
      if (raw) this._sharedData = JSON.parse(raw);
    } catch {}
    if (!this._sharedData.debts) this._sharedData.debts = [];

    // Pull from Supabase
    await this._pullSharedFromSupabase();

    // Start polling
    this._sharedTimer = setInterval(() => this._pullSharedFromSupabase(), SYNC_INTERVAL);
  },

  _saveShared() {
    this._sharedData._lastModified = Date.now();
    localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(this._sharedData));
    this._pushSharedToSupabase();
    this._sharedCallbacks.forEach(cb => cb());
  },

  // ── Shared space — debt CRUD ───────────────────────────────────────────────

  getSharedDebts()         { return [...(this._sharedData.debts || [])]; },
  getPendingSharedDebts()  { return this.getSharedDebts().filter(d => !d.isPaid); },
  getSettledSharedDebts()  { return this.getSharedDebts().filter(d => d.isPaid); },

  addSharedDebt(data) {
    if (!this._sharedData.debts) this._sharedData.debts = [];
    const debt = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      person: data.person || '',
      amount: data.amount,
      type: data.type || 'owed_to_me',
      description: data.description || '',
      category: data.category || 'Otros',
      date: data.date || new Date().toISOString().split('T')[0],
      isPaid: false,
      paidDate: null,
      paidTxId: null,
      _shared: true,
    };
    this._sharedData.debts.push(debt);
    this._saveShared();
    return debt;
  },

  addSharedDebtsForPeople({ persons = [], amount, type, description, category, date }) {
    return persons.map(person => this.addSharedDebt({ person, amount, type, description, category, date }));
  },

  updateSharedDebt(id, patch) {
    const d = (this._sharedData.debts || []).find(x => x.id === id);
    if (!d) return;
    Object.assign(d, patch);
    this._saveShared();
  },

  deleteSharedDebt(id) {
    if (!this._sharedData.debts) return;
    this._sharedData.debts = this._sharedData.debts.filter(d => d.id !== id);
    this._saveShared();
  },

  settleSharedDebt(id) {
    const d = (this._sharedData.debts || []).find(x => x.id === id);
    if (!d || d.isPaid) return;
    d.isPaid = true;
    d.paidDate = new Date().toISOString().split('T')[0];
    this._saveShared();
  },

  reopenSharedDebt(id) {
    const d = (this._sharedData.debts || []).find(x => x.id === id);
    if (!d) return;
    d.isPaid = false;
    d.paidDate = null;
    this._saveShared();
  },

  // ── Shared space — Tricount net balance ────────────────────────────────────

  getSharedNetBalance(person) {
    const pending = this.getPendingSharedDebts().filter(d => d.person === person);
    const owedToMe = pending.filter(d => (d.type || 'owed_to_me') === 'owed_to_me').reduce((s, d) => s + d.amount, 0);
    const iOwe     = pending.filter(d => d.type === 'i_owe').reduce((s, d) => s + d.amount, 0);
    return Math.round((owedToMe - iOwe) * 100) / 100;
  },

  settleSharedPersonNet(person) {
    const pending = this.getPendingSharedDebts().filter(d => d.person === person);
    if (!pending.length) return;
    const today = new Date().toISOString().split('T')[0];
    for (const d of pending) { d.isPaid = true; d.paidDate = today; }
    this._saveShared();
  },

  exportJSON({ months = null } = {}) {
    const d = JSON.parse(JSON.stringify(this._data));
    if (months && months.length) {
      const monthSet = new Set(months);
      d.transactions = (d.transactions || []).filter(t => {
        const m = t.month || (t.date && t.date.substring(0, 7));
        return monthSet.has(m);
      });
      const filteredArchives = {};
      for (const [m, txs] of Object.entries(d.archives || {})) {
        if (monthSet.has(m)) filteredArchives[m] = txs;
      }
      d.archives = filteredArchives;
      d._exportMonths = months;
    }
    d._exportedAt = new Date().toISOString();
    return JSON.stringify(d, null, 2);
  },

  getAvailableMonths() {
    const months = new Set();
    const d = this._data;
    if (d.currentMonth) months.add(d.currentMonth);
    for (const m of Object.keys(d.archives || {})) months.add(m);
    for (const t of d.transactions || []) {
      const m = t.month || (t.date && t.date.substring(0, 7));
      if (m) months.add(m);
    }
    return [...months].sort();
  },

  getMonthsFromPayload(payload) {
    const months = new Set();
    if (payload.currentMonth) months.add(payload.currentMonth);
    for (const m of Object.keys(payload.archives || {})) months.add(m);
    for (const t of payload.transactions || []) {
      const m = t.month || (t.date && t.date.substring(0, 7));
      if (m) months.add(m);
    }
    return [...months].sort();
  },

  _monthHasLocalData(month) {
    const d = this._data;
    if ((d.transactions || []).some(t => (t.month || t.date?.substring(0, 7)) === month)) return true;
    if ((d.archives[month] || []).length > 0) return true;
    return false;
  },

  _txExists(id) {
    const d = this._data;
    if ((d.transactions || []).some(t => t.id === id)) return true;
    for (const list of Object.values(d.archives || {})) {
      if (list.some(t => t.id === id)) return true;
    }
    return false;
  },

  _removeMonthData(month) {
    const d = this._data;
    d.transactions = (d.transactions || []).filter(t => (t.month || t.date?.substring(0, 7)) !== month);
    if (d.archives[month]) delete d.archives[month];
  },

  _placeTransaction(tx) {
    const d = this._data;
    const m = tx.month || tx.date?.substring(0, 7);
    if (!m) return;
    tx.month = m;
    if (m === d.currentMonth) {
      const idx = (d.transactions || []).findIndex(t => t.id === tx.id);
      if (idx >= 0) d.transactions[idx] = { ...d.transactions[idx], ...tx };
      else d.transactions.push(tx);
    } else {
      if (!d.archives[m]) d.archives[m] = [];
      const idx = d.archives[m].findIndex(t => t.id === tx.id);
      if (idx >= 0) d.archives[m][idx] = { ...d.archives[m][idx], ...tx };
      else d.archives[m].push(tx);
    }
  },

  collectIncomingTransactions(payload, months) {
    const monthSet = new Set(months);
    const txs = [];
    const seen = new Set();
    for (const t of payload.transactions || []) {
      const m = t.month || (t.date && t.date.substring(0, 7));
      if (!monthSet.has(m) || seen.has(t.id)) continue;
      seen.add(t.id);
      txs.push({ ...t, month: m });
    }
    for (const [m, list] of Object.entries(payload.archives || {})) {
      if (!monthSet.has(m)) continue;
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        txs.push({ ...t, month: t.month || m });
      }
    }
    return txs;
  },

  analyzeImportOverlap(payload, months) {
    const overlapMonths = months.filter(m => this._monthHasLocalData(m));
    const incoming = this.collectIncomingTransactions(payload, months);
    const incomingIds = new Set(incoming.map(t => t.id));
    let duplicateIds = 0;
    for (const t of this._data.transactions || []) {
      const m = t.month || t.date?.substring(0, 7);
      if (months.includes(m) && incomingIds.has(t.id)) duplicateIds++;
    }
    for (const m of months) {
      for (const t of this._data.archives[m] || []) {
        if (incomingIds.has(t.id)) duplicateIds++;
      }
    }
    return {
      overlapMonths,
      incomingCount: incoming.length,
      duplicateIds,
      hasConflict: overlapMonths.length > 0,
    };
  },

  importTransactionSubset(incomingTxs, months, strategy) {
    this._backup('pre-import');
    let added = 0, updated = 0, skipped = 0;
    const overlapMonths = months.filter(m => this._monthHasLocalData(m));

    if (strategy === 'keep') {
      const skipMonths = new Set(overlapMonths);
      for (const tx of incomingTxs) {
        const m = tx.month || tx.date?.substring(0, 7);
        if (skipMonths.has(m)) { skipped++; continue; }
        const existed = this._txExists(tx.id);
        this._placeTransaction(tx);
        if (existed) updated++; else added++;
      }
    } else if (strategy === 'replace') {
      for (const m of overlapMonths) this._removeMonthData(m);
      for (const tx of incomingTxs) {
        const existed = this._txExists(tx.id);
        this._placeTransaction(tx);
        if (existed) updated++; else added++;
      }
    } else {
      for (const tx of incomingTxs) {
        const existed = this._txExists(tx.id);
        this._placeTransaction(tx);
        if (existed) updated++; else added++;
      }
    }
    this._save();
    return { added, updated, skipped };
  },

  mergeGlobalPayload(from, { replaceLists = false } = {}) {
    const d = this._data;
    const mergeById = (arr, items, idKey = 'id') => {
      if (!items?.length) return arr || [];
      const map = new Map((arr || []).filter(x => x[idKey]).map(x => [x[idKey], x]));
      const noId = (arr || []).filter(x => !x[idKey]);
      for (const item of items) {
        if (item[idKey]) {
          map.set(item[idKey], map.has(item[idKey]) ? { ...map.get(item[idKey]), ...item } : item);
        } else {
          noId.push(item);
        }
      }
      return [...map.values(), ...noId];
    };

    if (from.debts?.length) d.debts = mergeById(d.debts || [], from.debts);
    if (from.people?.length) {
      for (const p of from.people) {
        const name = typeof p === 'string' ? p : p.name;
        if (name) this.rememberPerson(name, false);
      }
    }
    if (from.savingGoals?.length) d.savingGoals = mergeById(d.savingGoals || [], from.savingGoals);
    if (from.plannedExpenses?.length) d.plannedExpenses = mergeById(d.plannedExpenses || [], from.plannedExpenses);
    if (from.recurringTransactions?.length) d.recurringTransactions = mergeById(d.recurringTransactions || [], from.recurringTransactions);
    if (from.transfers?.length) d.transfers = mergeById(d.transfers || [], from.transfers);

    const scalarKeys = [
      'checkingBalance', 'checkingBaseBalance', 'savingsBalance', 'cashBalance',
      'imprevistosSavings', 'totalRoundUpSavings', 'foodBudget', 'imprevistosBudget',
      'roundUpEnabled', 'roundUpGoalId', 'savingsDay', 'plannedExpensesReserved',
      'initialCheckingBalance', 'initialSavingsBalance',
    ];
    for (const k of scalarKeys) {
      if (from[k] !== undefined && from[k] !== null) d[k] = from[k];
    }
    if (from.budgetConfig) d.budgetConfig = { ...d.budgetConfig, ...from.budgetConfig };
    if (from.expensePriorities) d.expensePriorities = { ...d.expensePriorities, ...from.expensePriorities };
    if (from.txGroups) d.txGroups = { ...d.txGroups, ...from.txGroups };

    if (replaceLists) {
      if (from.categories?.length) d.categories = [...from.categories];
      if (from.incomeCategories?.length) d.incomeCategories = [...from.incomeCategories];
      if (from.paymentMethods?.length) d.paymentMethods = [...from.paymentMethods];
      if (from.foodCategories?.length) d.foodCategories = [...from.foodCategories];
      if (from.categoryGroups?.length) d.categoryGroups = [...from.categoryGroups];
      if (from.incomeGroups?.length) d.incomeGroups = [...from.incomeGroups];
      if (from.peopleGroups?.length) d.peopleGroups = [...from.peopleGroups];
    } else {
      if (from.categories?.length) d.categories = [...new Set([...(d.categories || []), ...from.categories])];
      if (from.incomeCategories?.length) d.incomeCategories = [...new Set([...(d.incomeCategories || []), ...from.incomeCategories])];
      if (from.paymentMethods?.length) d.paymentMethods = [...new Set([...(d.paymentMethods || []), ...from.paymentMethods])];
      if (from.categoryGroups?.length) d.categoryGroups = mergeById(d.categoryGroups || [], from.categoryGroups);
      if (from.incomeGroups?.length) d.incomeGroups = mergeById(d.incomeGroups || [], from.incomeGroups);
      if (from.peopleGroups?.length) d.peopleGroups = mergeById(d.peopleGroups || [], from.peopleGroups);
    }
  },

  async importJSON(jsonStr, options = {}) {
    const d = JSON.parse(jsonStr);
    if (!d || !Array.isArray(d.transactions)) throw new Error('Datos inválidos');
    const { months = null, strategy = 'merge', mergeGlobal = true } = options;

    if (months && months.length) {
      const incoming = this.collectIncomingTransactions(d, months);
      const stats = this.importTransactionSubset(incoming, months, strategy);
      if (mergeGlobal) this.mergeGlobalPayload(d);
      await this._save({ awaitSync: true, forcePush: true });
      return stats;
    }

    this._backup('pre-import');
    this._data = d;
    this._migrate();
    await this._save({ awaitSync: true, forcePush: true });
    return { added: d.transactions.length, updated: 0, skipped: 0, full: true };
  },

  getRecurringTransactions() { return [...(this._data.recurringTransactions || [])]; },

  addRecurringTransaction(data) {
    const today = new Date().toISOString().split('T')[0];
    const r = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      name: data.name || '',
      amount: data.amount,
      type: data.type || 'Gasto',
      category: data.category || 'Otros',
      paymentMethod: data.paymentMethod || 'Tarjeta',
      frequency: data.frequency || 'monthly',
      dayOfMonth: data.dayOfMonth ?? new Date().getDate(),
      dayOfWeek: data.dayOfWeek ?? 1,
      nextDate: data.nextDate || today,
      active: data.active !== false,
      createdAt: new Date().toISOString(),
    };
    this._data.recurringTransactions.push(r);
    this._save();
    return r;
  },

  updateRecurringTransaction(id, updates) {
    const idx = this._data.recurringTransactions.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this._data.recurringTransactions[idx] = { ...this._data.recurringTransactions[idx], ...updates };
    this._save();
    return this._data.recurringTransactions[idx];
  },

  deleteRecurringTransaction(id) {
    this._data.recurringTransactions = this._data.recurringTransactions.filter(r => r.id !== id);
    this._save();
  },

  toggleRecurringTransaction(id) {
    const r = this._data.recurringTransactions.find(x => x.id === id);
    if (!r) return false;
    r.active = !r.active;
    this._save();
    return r.active;
  },

  _advanceRecurringDate(r, fromDate) {
    const d = new Date(fromDate + 'T12:00:00');
    if (r.frequency === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else if (r.frequency === 'yearly') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
      const dom = r.dayOfMonth || d.getDate();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dom, lastDay));
    }
    return d.toISOString().split('T')[0];
  },

  processRecurringTransactions() {
    const today = new Date().toISOString().split('T')[0];
    let generated = 0;
    for (const r of (this._data.recurringTransactions || [])) {
      if (!r.active) continue;
      let next = r.nextDate || today;
      let guard = 0;
      while (next <= today && guard++ < 24) {
        const nextDay = next.split('T')[0];
        const exists = this._data.transactions.some(t =>
          t.recurringId === r.id && (t.date || '').split('T')[0] === nextDay
        );
        if (!exists) {
          this.addTransaction({
            date: next,
            amount: r.amount,
            description: r.name || r.category,
            type: r.type,
            category: r.category,
            paymentMethod: r.paymentMethod,
            recurringId: r.id,
          });
          generated++;
        }
        next = this._advanceRecurringDate(r, next);
      }
      r.nextDate = next;
    }
    if (generated > 0) this._save();
    return generated;
  },

  getFrequentCategories(limit = 5) {
    const counts = {};
    for (const t of this._data.transactions) {
      if (t.type === 'Ingreso') continue;
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cat]) => cat);
  },

  getFrequentIncomeCategories(limit = 5) {
    const counts = {};
    for (const t of this._data.transactions) {
      if (t.type !== 'Ingreso') continue;
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cat]) => cat);
  },

  /**
   * Restablece la app a estado de fábrica.
   * - Limpia localStorage (datos, backups, configuración de sync, frase)
   * - Opcionalmente borra el blob del servidor (DELETE /api/data)
   * - Reinicia _data a defaultData vacío
   */
  async factoryReset({ deleteServer = false, confirmed = false } = {}) {
    if (!confirmed) {
      throw new Error('Restablecimiento cancelado — requiere confirmación explícita');
    }
    this._backup('pre-factory-reset');
    if (deleteServer) {
      try {
        if (this._isSupabase()) {
          const { supabaseRowId } = this.getSyncSettings();
          const id = supabaseRowId || 'default';
          await this._getSupabaseClient().from('sync_data').delete().eq('id', id);
        } else {
          await this._apiFetch('/api/data', { method: 'DELETE' });
        }
      } catch { /* ignore */ }
    }
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('ahorro_') || k === STORAGE_KEY)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.clearSyncConflict();
    const now = new Date();
    this._data = JSON.parse(JSON.stringify(defaultData));
    this._data.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this._data._lastModified = 0;
    this._ready = false;
    if (this._syncTimer) { clearInterval(this._syncTimer); this._syncTimer = null; }
    this._setSyncStatus('offline', 'Restablecido — configura la sincronización');
  },

  /** Returns true if a transaction is a balance-sync adjustment (not a real income/expense). */
  isAdjustment(t) { return t.category === '__ajuste__'; },
  isTraspaso(t)   { return t.type === 'Traspaso'; },
  isExpense(t)    { return t.type !== 'Ingreso' && t.type !== 'Traspaso' && !this.isAdjustment(t) && !t._debtPending; },
  isDebtExpense(t) { return t.type === 'Gasto' && !this.isAdjustment(t); },

  // ── Transaction groups ──────────────────────────────────────────────────────
  getTxGroups() { return this._data.txGroups || {}; },

  createTxGroup(name) {
    const id = 'grp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    if (!this._data.txGroups) this._data.txGroups = {};
    this._data.txGroups[id] = { name };
    this._save();
    return id;
  },

  renameTxGroup(id, name) {
    if (this._data.txGroups?.[id]) { this._data.txGroups[id].name = name; this._save(); }
  },

  deleteTxGroup(id) {
    this._data.transactions.forEach(t => { if (t.groupId === id) delete t.groupId; });
    delete this._data.txGroups?.[id];
    this._save();
  },

  setTxGroup(txId, groupId) {
    const t = this._data.transactions.find(x => x.id === txId);
    if (!t) return;
    if (groupId) t.groupId = groupId; else delete t.groupId;
    this._save();
  },

  /** Transactions visible in financial reports (excludes adjustments and internal system ops). */
  getReportableTransactions() {
    return this._data.transactions.filter(t => !this.isAdjustment(t));
  },

  validateData() {
    const d = this._data;
    if (!d || typeof d !== 'object') return 'No hay datos';
    if (!Array.isArray(d.transactions)) return 'transactions debe ser un array';
    if (!Array.isArray(d.categories)) return 'categories debe ser un array';
    if (d.incomeCategories && !Array.isArray(d.incomeCategories)) return 'incomeCategories debe ser un array';
    if (!Array.isArray(d.types)) return 'types debe ser un array';
    for (const t of d.transactions) {
      if (!t.id || !t.date || typeof t.amount !== 'number' || !t.type || !t.category) {
        return `Transacción inválida: ${t.id || 'sin id'}`;
      }
    }
    return null;
  },
};
