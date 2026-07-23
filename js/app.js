const App = {
  _currentViewMonth: null,
  _isArchived: false,

  async init() {
    this._detectMobileNav();
    await Store.init();
    // PIN lock: if a PIN is set, show the lock screen before anything else
    const pin = Store.getPinCode();
    if (pin) {
      const pinScreen = document.getElementById('pinScreen');
      if (pinScreen) {
        pinScreen.style.display = 'flex';
        document.getElementById('pinInput')?.focus();
        return; // _checkPin() will call _initAfterPin() to continue
      }
    }
    this._initAfterPin();
  },

  _checkPin() {
    const pin = Store.getPinCode();
    const val = document.getElementById('pinInput')?.value;
    if (val === pin) {
      document.getElementById('pinScreen').style.display = 'none';
      document.getElementById('pinInput').value = '';
      this._initAfterPin();
    } else {
      const err = document.getElementById('pinError');
      if (err) { err.textContent = '❌ PIN incorrecto'; setTimeout(() => { err.textContent = ''; }, 2000); }
      const inp = document.getElementById('pinInput');
      if (inp) { inp.value = ''; inp.focus(); }
    }
  },

  _setupTipHints() {
    document.addEventListener('touchstart', (e) => {
      const tip = e.target.closest('.tip-hint');
      document.querySelectorAll('.tip-hint.tip-open').forEach(el => {
        if (el !== tip) el.classList.remove('tip-open');
      });
      if (tip) { e.preventDefault(); tip.classList.toggle('tip-open'); }
    }, { passive: false });
  },

  async _initAfterPin() {
    if (!Store._ready) await Store.init();
    Store.processRecurringTransactions();
    const err = Store.validateData();
    if (err) { alert('Error: ' + err); return; }
    this._currentViewMonth = Store.getCurrentMonth();
    this._isArchived = false;
    Store.onChange(() => this._onRemoteUpdate());
    Store.onCloudDiffChange?.(() => {
      if (this._activeTabName?.() === 'categorias' && typeof Categorias !== 'undefined') {
        Categorias.render();
      }
    });
    Store.onSharedChange(() => { Deudas.render(); });
    this._renderMonthSelector();
    this._setupTabs();
    this._setupArchive();
    this._setupQuickAdd();
    this._setupRestore();
    this._setupTipHints();
    this._switchTab('dashboard');
    if (new URLSearchParams(window.location.search).get('action') === 'add') {
      setTimeout(() => this._openQuickAdd(), 300);
    }
    // Mostrar wizard solo si no hay datos ni sincronización configurada
    const hasData = Store.getTransactions().length > 0 || Object.keys(Store.getArchives()).length > 0;
    const hasSync = this._isCloudConfigured();
    const wizardSeen = localStorage.getItem('ahorro_wizard_seen');
    if (hasSync) localStorage.setItem('ahorro_wizard_seen', '1');
    if (!hasData && !hasSync && !wizardSeen) {
      setTimeout(() => this._showSetupWizard(), 800);
    } else {
      this._runStartupTasks();
    }
    setTimeout(() => this._checkSyncConflict(), 900);
  },

  async _checkCloudDifference() {
    // Solo manual desde Ajustes → Comparar con nube
  },

  _showCloudDiffBanner(diff) {
    const preferLocal = diff.localNewer;
    this.openModal({
      title: '☁️ La nube tiene datos distintos',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.6">
          Este dispositivo y la nube <strong>no coinciden</strong>.
          Si editaste aquí sin conexión, puedes <strong>subir tus cambios</strong> para actualizar el móvil, el PC u otros dispositivos.
        </p>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.5">
            <strong>📱 Este dispositivo</strong><br>${esc(diff.localSummary)}<br>
            <span style="color:var(--text-secondary)">Última modificación: ${esc(Store._formatSyncTime(diff.localTs))}</span>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.5">
            <strong>☁️ Nube</strong><br>${esc(diff.remoteSummary)}<br>
            <span style="color:var(--text-secondary)">Última modificación: ${esc(Store._formatSyncTime(diff.remoteTs))}</span>
          </div>
        </div>`,
      actions: [
        { label: 'Decidir más tarde' },
        { label: '⬇ Usar datos de la nube', cb: () => this._confirmCloudAction('remote') },
        {
          label: preferLocal ? '⬆ Subir a la nube (recomendado)' : '⬆ Subir a la nube',
          primary: true,
          cb: () => this._confirmCloudAction('local'),
        },
      ],
    });
  },

  _checkSyncConflict() {
    const conflict = Store.getSyncConflict?.();
    if (!conflict) return;
    const localBrief = Store._describeDataBrief(conflict.local);
    const remoteBrief = Store._describeDataBrief(conflict.remote);
    const localTs = Store._dataTimestamp(conflict.local);
    const remoteTs = Store._dataTimestamp(conflict.remote);
    const preferLocal = localTs >= remoteTs;

    this.openModal({
      title: '⚠️ ¿Qué datos quieres conservar?',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.6">
          Hay datos distintos en <strong>este dispositivo</strong> y en la <strong>nube</strong>.
          ${conflict.reason === 'simultaneous'
            ? 'Parece que <strong>dos dispositivos editaron a la vez</strong>. Elige qué copia quieres conservar.'
            : 'Hay datos distintos en la nube. Elige qué copia quieres conservar.'}
        </p>
        <div style="display:grid;gap:8px;margin-bottom:12px">
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.5">
            <strong>📱 Este dispositivo</strong><br>${esc(localBrief)}<br>
            <span style="color:var(--text-secondary)">Modificado: ${esc(Store._formatSyncTime(localTs))}</span>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;line-height:1.5">
            <strong>☁️ Nube</strong><br>${esc(remoteBrief)}<br>
            <span style="color:var(--text-secondary)">Modificado: ${esc(Store._formatSyncTime(remoteTs))}</span>
          </div>
        </div>
        <p style="font-size:11px;color:var(--text-secondary);line-height:1.5">
          <strong>Subir a la nube</strong> actualiza los otros dispositivos con lo que tienes aquí.
          <strong>Usar la nube</strong> reemplaza lo de este dispositivo con la copia remota.
        </p>`,
      actions: [
        { label: 'Decidir más tarde' },
        { label: '⬇ Usar datos de la nube', cb: () => this._resolveSyncConflict('remote') },
        {
          label: preferLocal ? '⬆ Subir a la nube (recomendado)' : '⬆ Subir a la nube',
          primary: true,
          cb: () => this._resolveSyncConflict('local'),
        },
      ],
    });
  },

  _confirmCloudAction(choice) {
    const isUpload = choice === 'local';
    this.openModal({
      title: isUpload ? '⬆ ¿Subir a la nube?' : '⬇ ¿Descargar de la nube?',
      body: `
        <p style="font-size:13px;color:var(--text);line-height:1.6">
          ${isUpload
            ? 'La copia de la <strong>nube se reemplazará</strong> con los datos de este dispositivo. Los otros dispositivos recibirán estos cambios al sincronizar.'
            : 'Los datos de <strong>este dispositivo se reemplazarán</strong> con la copia de la nube. Se guardará una copia de seguridad local antes.'}
        </p>`,
      actions: [
        { label: 'Cancelar' },
        {
          label: isUpload ? 'Sí, subir a la nube' : 'Sí, usar la nube',
          primary: true,
          cb: () => this._applyCloudChoice(choice),
        },
      ],
    });
  },

  async _applyCloudChoice(choice) {
    const ok = await Store.resolveSyncConflict(choice);
    if (ok) {
      this._currentViewMonth = Store.getCurrentMonth();
      this._renderMonthSelector();
      this._refreshAll();
      this.showToast(choice === 'remote' ? '✅ Datos de la nube aplicados' : '✅ Datos subidos a la nube');
      if (typeof Categorias !== 'undefined') Categorias.render?.();
    } else {
      this.showToast('❌ No se pudo completar la operación', 4000);
    }
  },

  async _resolveSyncConflict(choice) {
    await this._applyCloudChoice(choice);
  },

  _runStartupTasks() {
    setTimeout(async () => {
      if (typeof Install !== 'undefined') await Install.checkOnStartup();
      if (typeof StoragePrefs !== 'undefined' && !StoragePrefs.isConfigured()) {
        StoragePrefs.showSetupWizard();
      }
    }, 600);
  },

  _isCloudConfigured() {
    if (typeof Store === 'undefined') return false;
    if (Store._isSupabase && Store._isSupabase()) return true;
    const s = Store.getSyncSettings();
    return !!(s.serverUrl && s.syncKey);
  },

  _shouldShowSetupWizard() {
    if (localStorage.getItem('ahorro_wizard_seen')) return false;
    if (this._isCloudConfigured()) return false;
    const hasData = Store.getTransactions().length > 0 || Object.keys(Store.getArchives()).length > 0;
    return !hasData;
  },

  _showSetupWizard() {
    this.openModal({
      title: '👋 Bienvenido a Presupuesto Personal',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:14px;line-height:1.6">
          Para usar la app en móvil y ordenador sincronizados, configura la nube.<br>
          Si solo quieres usarla en este dispositivo, pulsa <strong>"Solo aquí"</strong>.
        </p>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <button class="btn btn-primary" onclick="App._wizardConfigCloud()" style="font-size:13px;padding:12px">
            ☁️ Sincronizar en la nube (móvil + PC)
          </button>
          <button class="btn btn-secondary" onclick="App._wizardLocalOnly()" style="font-size:13px;padding:12px">
            📱 Solo en este dispositivo
          </button>
        </div>

        <div style="font-size:11px;color:var(--text-secondary);padding:8px;background:var(--bg);border-radius:6px;line-height:1.5;margin-bottom:10px">
          Con la opción nube, tus datos se cifran en tu dispositivo con <strong>AES-256</strong> antes de subirse.
          El hosting nunca puede leerlos.
        </div>
        <button class="btn btn-secondary" onclick="App._wizardTutorial()" style="width:100%;font-size:12px;padding:10px">
          📖 Ver tutorial completo primero
        </button>`,
      actions: [],
    });
  },

  _wizardLocalOnly() {
    localStorage.setItem('ahorro_wizard_seen', '1');
    this._closeModal();
    this.showToast('✅ Listo. Puedes configurar la sincronización en ⚙️ → Sincronización en cualquier momento.');
    this._runStartupTasks();
  },

  _wizardConfigCloud() {
    this._closeModal();
    localStorage.setItem('ahorro_wizard_seen', '1');
    this._switchTab('categorias');
    setTimeout(() => {
      document.getElementById('syncServerUrl')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.showToast('👆 Rellena la URL del servidor, la clave y la frase de cifrado', 5000);
    }, 300);
    this._runStartupTasks();
  },

  _wizardTutorial() {
    this._closeModal();
    localStorage.setItem('ahorro_wizard_seen', '1');
    setTimeout(() => Tutorial.open(0), 200);
    this._runStartupTasks();
  },

  _onRemoteUpdate() {
    this._currentViewMonth = Store.getCurrentMonth();
    this._renderMonthSelector();
    this._refreshAll();
  },

  getCurrentViewMonth() { return this._currentViewMonth; },
  isViewingArchived() { return this._isArchived; },

  getCurrentTransactions() {
    if (this._isArchived) return Store.getArchivedMonth(this._currentViewMonth) || [];
    return Store.getTransactions().filter(t => t.month === this._currentViewMonth);
  },

  _renderMonthSelector() {
    const sel = document.getElementById('monthSelector');
    const current = Store.getCurrentMonth();
    const archived = Store.getArchivedMonths();
    const allMonths = [...new Set([current, ...archived])].sort().reverse();
    sel.innerHTML = '';
    allMonths.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      const [y, mo] = m.split('-').map(Number);
      opt.textContent = `${MONTHS[mo - 1]} ${y}`;
      if (m === current) opt.textContent += ' ●';
      if (m === this._currentViewMonth) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => {
      this._currentViewMonth = sel.value;
      this._isArchived = sel.value !== Store.getCurrentMonth();
      document.getElementById('archiveBtn').style.display = this._isArchived ? 'none' : '';
      if (typeof Calendario !== 'undefined') Calendario.resetView();
      this._refreshAll();
    };
  },

  _setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });
    // Bottom nav buttons also need click handlers
    document.querySelectorAll('.bottom-nav-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });
  },

  _activeTabName() {
    const el = document.querySelector('.tab-content.active');
    return el ? el.id.replace('tab-', '') : null;
  },

  _renderTab(tab) {
    if (tab === 'dashboard') Dashboard.render();
    else if (tab === 'registro') Registro.render();
    else if (tab === 'calendario') Calendario.render();
    else if (tab === 'deudas') Deudas.render();
    else if (tab === 'graficos') Graficos.render();
    else if (tab === 'categorias') Categorias.render();
    else if (tab === 'presupuesto') Presupuesto.render();
  },

  _switchTab(tab) {
    const prev = this._activeTabName();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    const tb = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tb) tb.classList.add('active');
    const bnb = document.querySelector(`.bottom-nav-btn[data-tab="${tab}"]`);
    if (bnb) bnb.classList.add('active');
    const tc = document.getElementById(`tab-${tab}`);
    if (tc) tc.classList.add('active');
    this._renderTab(tab);
    if (prev !== tab) window.scrollTo(0, 0);
  },

  _detectMobileNav() {
    const apply = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const touch = navigator.maxTouchPoints > 1;
      const narrow = window.innerWidth <= 768;
      const tabletPortrait = window.innerWidth <= 1024 && portrait;
      const mobile = narrow || tabletPortrait || (touch && window.innerWidth < 1100);
      document.body.classList.toggle('mobile-nav', mobile);
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
  },

  _setupArchive() {
    document.getElementById('archiveBtn').addEventListener('click', () => {
      const n = this.getCurrentTransactions().length;
      this.showConfirm('Archivar mes', n === 0 ? '¿Archivar mes vacío?' : `¿Archivar ${n} movimiento${n !== 1 ? 's' : ''}?`, () => {
        Store.archiveCurrentMonth();
        this._currentViewMonth = Store.getCurrentMonth();
        this._isArchived = false;
        document.getElementById('archiveBtn').style.display = '';
        this._renderMonthSelector();
        this._refreshAll();
      });
    });
  },

  _setupRestore() {
    document.getElementById('restoreInput').addEventListener('change', (e) => {
      BackupIO._openViaInput(e.target, 'json');
    });
  },

  _setupQuickAdd() {
    const fab = document.getElementById('quickAddBtn');
    const overlay = document.getElementById('quickOverlay');
    const backdrop = document.getElementById('quickBackdrop');

    fab.addEventListener('click', () => {
      this._openQuickAdd();
    });

    backdrop.addEventListener('click', () => this._closeQuickAdd());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeQuickAdd(); });
  },

  _openQuickAdd(presetDate) {
    const overlay = document.getElementById('quickOverlay');
    const backdrop = document.getElementById('quickBackdrop');
    const form = document.getElementById('quickForm');
    backdrop.classList.add('open');
    overlay.classList.add('open');

    const today = presetDate || new Date().toISOString().split('T')[0];
    const expenseCats = Store.getCategories();
    const methods = Store.getPaymentMethods();

    form.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="flex:1;display:flex;background:var(--bg);border-radius:8px;padding:3px;gap:2px">
          <button class="qa-type-btn active" data-qa-type="Gasto" style="flex:1;padding:8px;border:none;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">💸 Gasto</button>
          <button class="qa-type-btn" data-qa-type="Ingreso" style="flex:1;padding:8px;border:none;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">💰 Ingreso</button>
          <button class="qa-type-btn" data-qa-type="Traspaso" style="flex:1;padding:8px;border:none;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">⇄ Traspaso</button>
        </div>
        <button class="btn btn-secondary" onclick="App._closeQuickAdd()" style="padding:8px 12px">✕</button>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="form-group">
          <label>Importe</label>
          <input type="number" id="qaAmount" step="0.01" min="0.01" placeholder="0.00" style="font-size:20px;font-weight:700" autofocus>
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="qaDate" value="${today}">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Descripción</label>
          <input type="text" id="qaDesc" placeholder="¿Concepto?" maxlength="100">
        </div>
        <div class="form-group" id="qaCategoryGroup">
          <label>Categoría</label>
          <select id="qaCategory">${expenseCats.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        </div>
        <div class="form-group" id="qaMethodGroup">
          <label>Pago</label>
          <select id="qaMethod">${methods.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
        </div>
        <div class="form-group" id="qaAccountGroup">
          <label>Cuenta</label>
          <select id="qaAccount">
            <option value="checking">💳 Corriente</option>
            <option value="savings">🐷 Ahorro</option>
            <option value="cash">💵 Efectivo</option>
          </select>
        </div>
      </div>
      <div id="qaTransferTypeRow" style="display:none;margin:8px 0;padding:8px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px">Tipo de traspaso:</div>
        <div style="display:flex;gap:6px">
          <button type="button" id="qaTransferTo" class="mf-type-btn active" style="flex:1;background:linear-gradient(135deg,#4F46E5,#10B981);color:#fff;border:none;font-size:12px;padding:8px"
            onclick="App._setQuickTransferType('to_savings')">💸→🐷 Corriente → Ahorro</button>
          <button type="button" id="qaTransferFrom" class="mf-type-btn" style="flex:1;font-size:12px;padding:8px"
            onclick="App._setQuickTransferType('from_savings_emergency')">🆘 Ahorro → Corriente</button>
        </div>
        <input type="hidden" id="qaTransferType" value="to_savings">
      </div>
      <div id="qaBudgetHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" style="flex:1;padding:12px;font-size:16px" id="qaSubmit">➕ Añadir</button>
      </div>
    `;

    document.getElementById('qaAmount').focus();

    document.querySelectorAll('.qa-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.qa-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.qaType;
        const isTraspaso = type === 'Traspaso';
        document.getElementById('qaSubmit').textContent =
          type === 'Gasto' ? '➕ Añadir gasto' : type === 'Ingreso' ? '💰 Añadir ingreso' : '⇄ Añadir traspaso';
        ['qaCategoryGroup', 'qaMethodGroup', 'qaAccountGroup'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = isTraspaso ? 'none' : '';
        });
        const trRow = document.getElementById('qaTransferTypeRow');
        if (trRow) trRow.style.display = isTraspaso ? '' : 'none';
        if (isTraspaso) {
          const desc = document.getElementById('qaDesc');
          if (desc && !desc.value) desc.value = 'Traspaso a ahorro';
          document.getElementById('qaBudgetHint').style.display = 'none';
          return;
        }
        const cats = Store.getCategoriesForType(type);
        const defaultCat = type === 'Ingreso'
          ? (cats.includes('Mensualidad') ? 'Mensualidad' : cats[0])
          : (cats.includes('Comida') ? 'Comida' : cats[0]);
        const sel = document.getElementById('qaCategory');
        const current = sel.value;
        const pick = cats.includes(current) ? current : defaultCat;
        sel.innerHTML = cats.map(c => `<option value="${c}" ${c === pick ? 'selected' : ''}>${c}</option>`).join('');
        this._checkQuickBudget();
      });
    });

    document.getElementById('qaAmount').focus();

    document.getElementById('qaCategory').addEventListener('change', () => this._checkQuickBudget());
    document.getElementById('qaAmount').addEventListener('input', () => this._checkQuickBudget());
    document.getElementById('qaMethod').addEventListener('change', () => {
      const method = document.getElementById('qaMethod').value;
      const accountSel = document.getElementById('qaAccount');
      if (accountSel && method === 'Efectivo') accountSel.value = 'cash';
      else if (accountSel && accountSel.value === 'cash') accountSel.value = 'checking';
    });

    document.getElementById('qaSubmit').addEventListener('click', () => this._submitQuickAdd());
    document.getElementById('qaAmount').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submitQuickAdd();
    });
  },

  _setQuickTransferType(ttype) {
    const hidden = document.getElementById('qaTransferType');
    if (hidden) hidden.value = ttype;
    const btnTo = document.getElementById('qaTransferTo');
    const btnFrom = document.getElementById('qaTransferFrom');
    if (!btnTo || !btnFrom) return;
    if (ttype === 'to_savings') {
      btnTo.style.background = 'linear-gradient(135deg,#4F46E5,#10B981)';
      btnTo.style.color = '#fff';
      btnTo.style.border = 'none';
      btnFrom.style.background = '';
      btnFrom.style.color = '';
      btnFrom.style.border = '';
      const desc = document.getElementById('qaDesc');
      if (desc) desc.value = 'Traspaso a ahorro';
    } else {
      btnFrom.style.background = 'linear-gradient(135deg,#EC4899,#EF4444)';
      btnFrom.style.color = '#fff';
      btnFrom.style.border = 'none';
      btnTo.style.background = '';
      btnTo.style.color = '';
      btnTo.style.border = '';
      const desc = document.getElementById('qaDesc');
      if (desc) desc.value = 'Gasto de ahorro (imprevisto)';
    }
  },

  _checkQuickBudget() {
    const el = document.getElementById('qaBudgetHint');
    if (!el) return;
    const cat = document.getElementById('qaCategory')?.value;
    const amt = parseFloat(document.getElementById('qaAmount')?.value) || 0;
    if (!cat || amt <= 0) { el.style.display = 'none'; return; }
    const alert = Presupuesto.getAlertLevel(cat, amt);
    if (!alert) { el.style.display = 'none'; return; }
    const { alreadySpent, projectedTotal, limit, level } = alert;
    const pct = ((projectedTotal / limit) * 100).toFixed(0);
    const remaining = limit - projectedTotal;
    const colors = { good: 'var(--income)', caution: '#F59E0B', warning: '#F97316', danger: 'var(--expense)' };
    const labels = { good: '✅ Bien', caution: '🟡 Cuidado', warning: '⚠️ Casi al límite', danger: '🔴 Excedido' };
    const bgs = { good: 'var(--income-bg)', caution: 'var(--warn-bg)', warning: 'var(--warn-bg)', danger: 'var(--expense-bg)' };
    el.style.display = 'block';
    el.style.background = bgs[level];
    el.style.color = colors[level];
    el.innerHTML = `${labels[level]} — ${alreadySpent.toFixed(2)} € + ${amt.toFixed(2)} € = ${projectedTotal.toFixed(2)} € / ${limit.toFixed(2)} € (${pct}%)`;
  },

  _submitQuickAdd() {
    const amount = parseFloat(document.getElementById('qaAmount').value);
    const date = document.getElementById('qaDate').value;
    const desc = document.getElementById('qaDesc').value.trim();
    const category = document.getElementById('qaCategory').value;
    const method = document.getElementById('qaMethod').value;
    const account = document.getElementById('qaAccount')?.value || 'checking';
    const type = document.querySelector('.qa-type-btn.active')?.dataset?.qaType || 'Gasto';

    if (!amount || amount <= 0 || !date) return;

    if (type === 'Traspaso') {
      const transferType = document.getElementById('qaTransferType')?.value || 'to_savings';
      const result = Store.createAccountTransfer({
        amount,
        date,
        description: desc || (transferType === 'from_savings_emergency' ? 'Gasto de ahorro (imprevisto)' : 'Traspaso a ahorro'),
        transferType,
        emoji: transferType === 'from_savings_emergency' ? '🆘' : '🐷',
      });
      if (result === -1) {
        App.showToast(transferType === 'from_savings_emergency'
          ? '❌ Saldo insuficiente en ahorro'
          : '❌ Saldo insuficiente en cuenta corriente');
        return;
      }
      this._closeQuickAdd();
      this._refreshAll();
      App.showToast('✅ Traspaso registrado');
      return;
    }

    Store.addTransaction({ date, amount, description: desc, type, category, paymentMethod: method, account });
    if (type === 'Ingreso') {
      App.suggestSavings(amount);
    }

    this._closeQuickAdd();
    this._refreshAll();
    Presupuesto.render();
  },

  _closeQuickAdd() {
    document.getElementById('quickOverlay').classList.remove('open');
    document.getElementById('quickBackdrop').classList.remove('open');
  },

  _refreshAll() {
    const tab = this._activeTabName();
    if (tab) this._renderTab(tab);
  },

  _refreshConfigDependents() {
    this._renderMonthSelector();
    const tabs = ['registro', 'calendario', 'presupuesto', 'deudas', 'dashboard', 'graficos'];
    for (const tab of tabs) {
      if (document.getElementById(`tab-${tab}`)?.classList.contains('active')) {
        if (tab === 'registro') Registro.render();
        else if (tab === 'calendario') Calendario.render();
        else if (tab === 'presupuesto') Presupuesto.render();
        else if (tab === 'deudas') Deudas.render();
        else if (tab === 'dashboard') Dashboard.render();
        else if (tab === 'graficos') Graficos.render();
      }
    }
  },

  _exportData() {
    BackupIO.exportFlow('json');
  },

  /**
   * Universal modal API.
   * actions: [{label, primary, cb}]  — each defines its own button and callback.
   * Clicking any button closes the modal then calls its cb (if provided).
   */
  openModal({ title, body, actions = [] }) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const actionsEl = document.getElementById('modalActions');

    overlay.style.removeProperty('display');
    titleEl.textContent = title || '';
    bodyEl.innerHTML = typeof body === 'string' ? body : '';
    actionsEl.innerHTML = '';

    const close = () => {
      overlay.classList.remove('open');
      overlay.style.removeProperty('display');
    };

    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.primary ? 'btn-primary' : 'btn-secondary'}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        close();
        if (typeof action.cb === 'function') action.cb();
      }, { once: true });
      actionsEl.appendChild(btn);
    }

    const onOverlayClick = (e) => { if (e.target === overlay) close(); };
    overlay.addEventListener('click', onOverlayClick, { once: true });
    overlay.classList.add('open');
  },

  /** Backwards-compatible: show a confirm dialog with Cancelar / custom confirm button. */
  showConfirm(title, message, callback) {
    this.openModal({
      title,
      body: `<p style="font-size:14px;color:var(--text-secondary)">${message}</p>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Confirmar', primary: true, cb: callback },
      ],
    });
  },

  /** Backwards-compatible: show a text prompt. */
  showPrompt(title, label, defaultValue, callback) {
    this.openModal({
      title,
      body: `<div class="form-group"><label>${label}</label><input type="text" id="promptInput" value="${defaultValue || ''}" style="width:100%"></div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Aceptar', primary: true, cb: () => callback(document.getElementById('promptInput')?.value.trim() || '') },
      ],
    });
    const inp = document.getElementById('promptInput');
    if (inp) { inp.focus(); inp.select(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { this._closeModal(); callback(inp.value.trim()); } }, { once: true }); }
  },

  /** Backwards-compatible: show a custom HTML modal with one or two action buttons.
   *  If `cancelText` is falsy, no cancel button is shown (single-action modal). */
  showCustom(title, html, confirmText, callback, cancelText = 'Cancelar') {
    const actions = [];
    if (cancelText) actions.push({ label: cancelText });
    actions.push({ label: confirmText || 'Aceptar', primary: true, cb: callback });
    this.openModal({ title, body: html, actions });
  },

  _closeModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('open');
    overlay.style.removeProperty('display');
  },

  _getModal() {
    return { overlay: document.getElementById('modalOverlay') };
  },

  /** Performs the actual savings transfer (shared between modal modes). */
  _doSavingsTransfer(val, description) {
    if (!val || val <= 0) return;
    const result = Store.createAccountTransfer({
      amount: val,
      description: description || 'Ahorro automático desde ingreso',
      logNote: description || 'Ahorro automático',
      transferType: 'to_savings',
      emoji: '🐷',
    });
    if (result === -1) {
      App.showToast('❌ Saldo insuficiente en cuenta corriente');
      return;
    }
    if (result) App.showToast(`✅ ${val.toFixed(2)} € transferidos al ahorro`);
  },

  /** Shared saving-suggestion logic. Safe to call even if Registro tab was never visited. */
  suggestSavings(incomeAmount) {
    const goals = Store.getSavingGoals();
    const goalsWeekly = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();

    // --- Compute average monthly expense from real historical data ---
    const archives = Store.getArchives();
    const currentTx = Store.getTransactions().filter(t => Store.isSpendableExpense(t));
    const byMonth = {};
    for (const t of currentTx) { byMonth[t.month] = (byMonth[t.month] || 0) + t.amount; }
    for (const [month, txs] of Object.entries(archives)) {
      const exp = txs.filter(t => Store.isSpendableExpense(t)).reduce((s, t) => s + t.amount, 0);
      if (exp > 0) byMonth[month] = exp;
    }
    const numMonths = Math.max(Object.keys(byMonth).length, 1);
    const avgMonthly = Object.values(byMonth).reduce((s, v) => s + v, 0) / numMonths;
    const isLargeIncome = avgMonthly > 0 && incomeAmount >= avgMonthly * 1.5;

    if (isLargeIncome) {
      // --- Large income mode ---
      const checking = Store.getCheckingBalance() ?? 0;
      const savings = Store.getSavingsBalance() ?? 0;
      const totalWealth = checking + savings + incomeAmount;
      const monthsAutonomy = avgMonthly > 0 ? totalWealth / avgMonthly : 0;

      // Suggestion: keep 1 month living expenses, save the rest
      const keepForMonth = Math.ceil(avgMonthly);
      const suggestSave = Math.max(0, Math.floor(incomeAmount - keepForMonth));
      const monthsIfSaved = avgMonthly > 0 ? (checking + savings + suggestSave) / avgMonthly : 0;

      this.openModal({
        title: '🎉 ¡Gran ingreso recibido!',
        body: `
          <div style="background:linear-gradient(135deg,#4F46E5,#10B981);border-radius:12px;padding:14px;color:#fff;margin-bottom:14px;text-align:center">
            <div style="font-size:13px;opacity:0.85">Ingreso recibido</div>
            <div style="font-size:28px;font-weight:800">+${incomeAmount.toFixed(2)} €</div>
            <div style="font-size:11px;opacity:0.8;margin-top:2px">Tu gasto medio mensual es ${avgMonthly.toFixed(0)} €</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
              <div style="font-size:10px;color:var(--text-secondary)">Meses de autonomía actuales</div>
              <div style="font-size:18px;font-weight:800;color:${monthsAutonomy >= 6 ? 'var(--income)' : '#F59E0B'}">${((checking + savings) / avgMonthly).toFixed(1)}</div>
            </div>
            <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
              <div style="font-size:10px;color:var(--text-secondary)">Si ahorras la sugerencia</div>
              <div style="font-size:18px;font-weight:800;color:var(--income)">${monthsIfSaved.toFixed(1)} meses</div>
            </div>
          </div>
          <div style="background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--warn-text)">
            <strong>💡 Recomendación:</strong> Aparta la mayor parte al ahorro. Vive del saldo ya existente en corriente y usa este ingreso para ganar autonomía financiera.
          </div>
          <div style="margin-bottom:10px">
            <label style="font-size:13px;font-weight:700;display:block;margin-bottom:4px">¿Cuánto apartar al ahorro?</label>
            <input type="number" id="suggestSavingsAmount" value="${suggestSave}" step="1" min="0" max="${incomeAmount}"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="document.getElementById('suggestSavingsAmount').value=${suggestSave}">Sugerido (${suggestSave} €)</button>
              <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="document.getElementById('suggestSavingsAmount').value=${Math.floor(incomeAmount * 0.8)}">80% (${Math.floor(incomeAmount * 0.8)} €)</button>
              <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="document.getElementById('suggestSavingsAmount').value=${Math.floor(incomeAmount * 0.5)}">50% (${Math.floor(incomeAmount * 0.5)} €)</button>
            </div>
          </div>`,
        actions: [
          { label: 'Solo registrar' },
          { label: '🐷 Apartar al ahorro', primary: true, cb: () => {
            const val = parseFloat(document.getElementById('suggestSavingsAmount')?.value);
            App._doSavingsTransfer(val, `Ahorro desde gran ingreso (${incomeAmount.toFixed(0)} €)`);
          }},
        ],
      });
      return;
    }

    // --- Normal income mode ---
    const totalWeekly = goalsWeekly + peWeekly;
    if (totalWeekly <= 0) return;
    const suggestAmount = Math.min(incomeAmount, Math.round(totalWeekly));
    if (suggestAmount <= 1) return;
    const detail = [];
    if (goalsWeekly > 0) detail.push(`🎯 Metas: ${goalsWeekly.toFixed(2)} €/sem`);
    if (peWeekly > 0) detail.push(`📋 Gastos planif.: ${peWeekly.toFixed(2)} €/sem`);
    this.openModal({
      title: '💰 ¿Apartar para ahorro?',
      body: `<p style="font-size:14px;margin-bottom:8px">Has recibido <strong>${incomeAmount.toFixed(2)} €</strong>. Necesitas <strong>${totalWeekly.toFixed(2)} €/sem</strong> para tus objetivos:</p>
      ${detail.map(d => `<div style="font-size:13px;padding:2px 0">${d}</div>`).join('')}
      <div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px">
        <label style="font-size:13px;font-weight:600">Transferir a cuenta de ahorro:</label>
        <input type="number" id="suggestSavingsAmount" value="${suggestAmount}" step="1" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-top:4px;font-size:16px">
      </div>`,
      actions: [
        { label: 'Ahora no' },
        { label: '✅ Transferir', primary: true, cb: () => {
          const val = parseFloat(document.getElementById('suggestSavingsAmount')?.value);
          App._doSavingsTransfer(val, 'Ahorro automático desde ingreso');
        }},
      ],
    });
  },

  showToast(message, duration = 2800) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
