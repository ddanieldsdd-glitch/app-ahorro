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

  _toggleMoreMenu() {
    const menu = document.getElementById('bottomNavMenu');
    if (!menu) return;
    const open = menu.style.display !== 'none';
    menu.style.display = open ? 'none' : 'flex';
    if (!open) {
      const close = (e) => { if (!e.target.closest('#bottomNavMenu, .bottom-nav-more')) { menu.style.display = 'none'; document.removeEventListener('click', close); } };
      setTimeout(() => document.addEventListener('click', close), 10);
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
    this._renderMonthSelector();
    this._setupTabs();
    this._setupArchive();
    this._setupQuickAdd();
    this._setupRestore();
    this._setupTipHints();
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
    document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
    const tb = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tb) tb.classList.add('active');
    const bnb = document.querySelector(`.bottom-nav-btn[data-tab="${tab}"]`);
    if (bnb) bnb.classList.add('active');
    const tc = document.getElementById(`tab-${tab}`);
    if (tc) tc.classList.add('active');
    if (tab === 'dashboard') Dashboard.render();
    else if (tab === 'registro') Registro.render();
    else if (tab === 'calendario') Calendario.render();
    else if (tab === 'deudas') Deudas.render();
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
    const expenseCats = Store.getCategories();
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
          <select id="qaCategory">${expenseCats.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
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
    `;

    document.getElementById('qaAmount').focus();

    document.querySelectorAll('.qa-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.qa-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.qaType;
        const isExpense = type === 'Gasto';
        document.getElementById('qaSubmit').textContent = isExpense ? '➕ Añadir gasto' : '💰 Añadir ingreso';
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

    if (!amount || amount <= 0 || !date) return;

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

  /** Performs the actual savings transfer (shared between modal modes). */
  _doSavingsTransfer(val, description) {
    if (!val || val <= 0) return;
    Store.addTransfer(val, description || 'Ahorro automático');
    const ck = Store.getCheckingBalance();
    if (ck !== null) Store.setCheckingBalance(Math.max(0, ck - val));
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: 'Gasto', category: 'Ahorro',
      amount: val,
      description: description || 'Ahorro automático desde ingreso',
      paymentMethod: 'Transferencia',
      account: 'checking',
      _noAutoBalance: true,
    };
    Store.getData().transactions.push(tx);
    Store._save();
    App.showToast(`✅ ${val.toFixed(2)} € transferidos al ahorro`);
  },

  /** Shared saving-suggestion logic. Safe to call even if Registro tab was never visited. */
  suggestSavings(incomeAmount) {
    const goals = Store.getSavingGoals();
    const goalsWeekly = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();

    // --- Compute average monthly expense from real historical data ---
    const archives = Store.getArchives();
    const currentTx = Store.getTransactions().filter(t => !Store.isAdjustment(t) && t.type !== 'Ingreso');
    const byMonth = {};
    for (const t of currentTx) { byMonth[t.month] = (byMonth[t.month] || 0) + t.amount; }
    for (const [month, txs] of Object.entries(archives)) {
      const exp = txs.filter(t => !Store.isAdjustment(t) && t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
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
          <div style="background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#78350F">
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
