const App = {
  _currentViewMonth: null,
  _isArchived: false,

  async init() {
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

  async _initAfterPin() {
    if (!Store._ready) await Store.init();
    Store.processRecurringTransactions();
    const err = Store.validateData();
    if (err) { alert('Error: ' + err); return; }
    this._currentViewMonth = Store.getCurrentMonth();
    this._isArchived = false;
    Store.onChange(() => this._onRemoteUpdate());
    this._renderMonthSelector();
    this._setupTabs();
    this._setupArchive();
    this._setupQuickAdd();
    this._setupRestore();
    this._switchTab('dashboard');
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
  },

  _switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tb = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tb) tb.classList.add('active');
    const tc = document.getElementById(`tab-${tab}`);
    if (tc) tc.classList.add('active');
    if (tab === 'dashboard') Dashboard.render();
    else if (tab === 'registro') Registro.render();
    else if (tab === 'calendario') Calendario.render();
    else if (tab === 'semanas') Semanas.render();
    else if (tab === 'graficos') Graficos.render();
    else if (tab === 'categorias') Categorias.render();
    else if (tab === 'presupuesto') Presupuesto.render();
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
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          Store.importJSON(ev.target.result);
          this._currentViewMonth = Store.getCurrentMonth();
          this._isArchived = false;
          this._renderMonthSelector();
          this._refreshAll();
          alert('Datos restaurados');
        } catch (err) { alert('Error: ' + err.message); }
      };
      reader.readAsText(file);
      e.target.value = '';
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
    const cats = Store.getCategories();
    const methods = Store.getPaymentMethods();

    form.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="flex:1;display:flex;background:var(--bg);border-radius:8px;padding:3px">
          <button class="qa-type-btn active" data-qa-type="Gasto" style="flex:1;padding:8px;border:none;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">💸 Gasto</button>
          <button class="qa-type-btn" data-qa-type="Ingreso" style="flex:1;padding:8px;border:none;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">💰 Ingreso</button>
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
        <div class="form-group">
          <label>Categoría</label>
          <select id="qaCategory">${cats.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Pago</label>
          <select id="qaMethod">${methods.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Cuenta</label>
          <select id="qaAccount">
            <option value="checking">💳 Corriente</option>
            <option value="savings">🐷 Ahorro</option>
            <option value="cash">💵 Efectivo (no computa)</option>
          </select>
        </div>
      </div>
      <div id="qaBudgetHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px"></div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" style="flex:1;padding:12px;font-size:16px" id="qaSubmit">➕ Añadir</button>
      </div>
      <div id="qaRoundUpRow">
        <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;color:var(--text-secondary);cursor:pointer">
          <input type="checkbox" id="qaRoundUp" checked> Redondear al euro y ahorrar la diferencia
        </label>
      </div>
    `;

    document.getElementById('qaAmount').focus();

    document.querySelectorAll('.qa-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.qa-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const isExpense = btn.dataset.qaType === 'Gasto';
        document.getElementById('qaRoundUpRow').style.display = isExpense ? '' : 'none';
        document.getElementById('qaSubmit').textContent = isExpense ? '➕ Añadir gasto' : '💰 Añadir ingreso';
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
    const bgs = { good: 'var(--income-bg)', caution: '#FFFBEB', warning: '#FFFBEB', danger: 'var(--expense-bg)' };
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
    const roundUp = document.getElementById('qaRoundUp')?.checked;

    if (!amount || amount <= 0 || !date) return;

    Store.addTransaction({ date, amount, description: desc, type, category, paymentMethod: method, account });

    if (type !== 'Ingreso' && roundUp) {
      const diff = Presupuesto.getRoundUp(amount);
      if (diff > 0) Store.addRoundUp(diff);
    }
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
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) this._switchTab(activeTab.dataset.tab);
  },

  _exportData() {
    try {
      const json = Store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const n = new Date();
      a.download = `presupuesto_${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Error: ' + e.message); }
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

    titleEl.textContent = title || '';
    bodyEl.innerHTML = typeof body === 'string' ? body : '';
    actionsEl.innerHTML = '';

    const close = () => overlay.classList.remove('open');

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
    document.getElementById('modalOverlay').classList.remove('open');
  },

  _getModal() {
    return { overlay: document.getElementById('modalOverlay') };
  },

  /** Shared saving-suggestion logic. Safe to call even if Registro tab was never visited. */
  suggestSavings(incomeAmount) {
    const goals = Store.getSavingGoals();
    const goalsWeekly = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();
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
          if (val > 0) {
            // addTransfer updates savingsBalance atomically; no separate setSavingsBalance needed
            Store.addTransfer(val, 'Ahorro automático');
            // Deduct from checking directly (transfer, not a new transaction to avoid double delta)
            const ck = Store.getCheckingBalance();
            if (ck !== null) Store.setCheckingBalance(Math.max(0, ck - val));
            // Register as a non-auto-balance internal tx for history
            Store.getTransactions(); // ensure loaded
            const tx = {
              id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
              date: new Date().toISOString().split('T')[0],
              month: Store.getCurrentMonth(),
              type: 'Gasto', category: 'Ahorro',
              amount: val,
              description: 'Ahorro automático desde ingreso',
              paymentMethod: 'Transferencia',
              account: 'checking',
              _noAutoBalance: true,
            };
            Store.getData().transactions.push(tx);
            Store._save();
            App.showToast(`✅ ${val.toFixed(2)} € transferidos al ahorro`);
          }
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
