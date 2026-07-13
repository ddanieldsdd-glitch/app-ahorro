const STORAGE_KEY = 'ahorro_presupuesto';
const BACKUP_KEY = 'ahorro_backup';
const SYNC_INTERVAL = 4000;

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
  types: ['Ingreso', 'Gasto'],
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
  transfers: [],
  pinCode: null,
  plannedExpenses: [],
  lastSavingsWeek: null,
  lastPEReserveWeek: null,
  savingsDay: 1,
  plannedExpensesReserved: 0,
  debts: [],
  recurringTransactions: [],
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
  _syncTimer: null,

  async init() {
    let loaded = false;

    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        this._data = await res.json();
        loaded = true;
      }
    } catch {}

    if (!loaded) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { this._data = JSON.parse(raw); } catch (e) {}
      }
    }

    if (!this._data || !this._data.transactions) {
      this._data = JSON.parse(JSON.stringify(defaultData));
      const now = new Date();
      this._data.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    this._migrate();
    this._ready = true;
    this._startSync();
    return this._data;
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
    if (!d.imprevistosSavings && d.imprevistosSavings !== 0) d.imprevistosSavings = 0;
    if (!d.plannedExpensesReserved && d.plannedExpensesReserved !== 0) d.plannedExpensesReserved = 0;
    if (d.lastSavingsWeek === undefined) d.lastSavingsWeek = null;
    if (d.lastPEReserveWeek === undefined) d.lastPEReserveWeek = null;
    if (d.savingsDay === undefined) d.savingsDay = 1;
    if (!d.debts) d.debts = [];
    if (!d.recurringTransactions) d.recurringTransactions = [];
    if (d.initialCheckingBalance === undefined) d.initialCheckingBalance = 0;
    if (d.initialSavingsBalance === undefined) d.initialSavingsBalance = 0;

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
  },

  _save() {
    this._data._lastModified = Date.now();
    const data = this._data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    this._saveCallbacks.forEach(cb => cb());
    fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('⚡ Cambios guardados solo localmente — sin conexión', 3500);
      }
    });
  },

  _startSync() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    this._syncTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) return;
        const serverData = await res.json();
        if (serverData._lastModified > this._data._lastModified) {
          this._data = serverData;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
          this._callbacks.forEach(cb => cb());
        }
      } catch {}
    }, SYNC_INTERVAL);
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
    const account = this._resolveAccount(t);
    if (account === 'cash') return;
    const delta = (t.type === 'Ingreso' ? t.amount : -t.amount) * sign;
    if (account === 'checking') {
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
    this._applyBalanceDelta(updated, 1);           // apply new effect
    this._data.transactions[idx] = updated;
    this._save();
    return updated;
  },

  deleteTransaction(id) {
    const t = this._data.transactions.find(x => x.id === id);
    if (!t) return;
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
  addCategory(name) {
    if (!this._data.categories.includes(name)) { this._data.categories.push(name); this._save(); }
  },
  deleteCategory(name) {
    this._data.categories = this._data.categories.filter(c => c !== name);
    this._save();
  },

  getTypes() { return [...this._data.types]; },
  addType(name) {
    if (!this._data.types.includes(name)) { this._data.types.push(name); this._save(); }
  },
  deleteType(name) {
    this._data.types = this._data.types.filter(t => t !== name);
    this._save();
  },

  getPaymentMethods() { return [...this._data.paymentMethods]; },
  addPaymentMethod(name) {
    if (!this._data.paymentMethods.includes(name)) { this._data.paymentMethods.push(name); this._save(); }
  },
  deletePaymentMethod(name) {
    this._data.paymentMethods = this._data.paymentMethods.filter(p => p !== name);
    this._save();
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
  setFoodBudget(v) { this._data.foodBudget = v; this._save(); },

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

  getCheckingBalance() { return this._data.checkingBalance; },
  setCheckingBalance(v) { this._data.checkingBalance = v; this._save(); },
  getCheckingBaseBalance() { return this._data.checkingBaseBalance ?? 0; },
  setCheckingBaseBalance(v) { this._data.checkingBaseBalance = v; this._save(); },
  getSavingsBalance() { return this._data.savingsBalance || 0; },
  setSavingsBalance(v) { this._data.savingsBalance = v; this._save(); },
  getTransfers() { return [...(this._data.transfers || [])]; },
  addTransfer(amount, note) {
    const t = { id: Date.now().toString(36), date: new Date().toISOString().split('T')[0], amount, note: note || '', month: Store.getCurrentMonth() };
    this._data.transfers.push(t);
    this._data.savingsBalance = (this._data.savingsBalance || 0) + amount;
    this._save();
    return t;
  },
  deleteTransfer(id) {
    const t = this._data.transfers.find(x => x.id === id);
    if (t) { this._data.savingsBalance = Math.max(0, (this._data.savingsBalance || 0) - t.amount); }
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
    const checking = this.getCheckingBalance();
    if (checking !== null && checking < totalWeekly) return -1;
    const t = { id: Date.now().toString(36), date: new Date().toISOString().split('T')[0], amount: totalWeekly, note: 'Ahorro semanal', month: Store.getCurrentMonth() };
    this._data.transfers.push(t);
    this._data.savingsBalance = (this._data.savingsBalance || 0) + totalWeekly;
    if (checking !== null) this._data.checkingBalance = Math.max(0, checking - totalWeekly);
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
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: 'Gasto', category: 'Ahorro',
      amount: totalWeekly,
      description: 'Ahorro semanal distribuido a metas',
      paymentMethod: 'Transferencia',
      account: 'checking',
      _noAutoBalance: true,   // balance already updated above directly
    };
    this._data.transactions.push(tx);
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
    const checking = this.getCheckingBalance();
    if (checking !== null && checking < totalWeekly) return -1;
    this._data.plannedExpensesReserved = (this._data.plannedExpensesReserved || 0) + totalWeekly;
    if (checking !== null) this._data.checkingBalance = Math.max(0, checking - totalWeekly);
    for (const p of active) {
      const remaining = p.amount - (p.savedSoFar || 0);
      const tgt = new Date(p.targetDate + 'T23:59:59');
      const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
      const need = remaining / weeksLeft;
      const plannedItem = this._data.plannedExpenses.find(x => x.id === p.id);
      if (plannedItem) plannedItem.savedSoFar = Math.min(p.amount, (plannedItem.savedSoFar || 0) + need);
    }
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: new Date().toISOString().split('T')[0],
      month: Store.getCurrentMonth(),
      type: 'Gasto', category: 'Ahorro programado',
      amount: totalWeekly,
      description: 'Reserva semanal para gastos planificados',
      paymentMethod: 'Transferencia',
      account: 'checking',
      _noAutoBalance: true,
    };
    this._data.transactions.push(tx);
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

  getDebts() { return [...(this._data.debts || [])]; },
  addDebt(person, amount, description) {
    const d = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
      person, amount, description: description || '',
      date: new Date().toISOString().split('T')[0],
      isPaid: false, paidDate: null, paidTo: null,
    };
    this._data.debts.push(d);
    this._save();
    return d;
  },
  deleteDebt(id) {
    this._data.debts = this._data.debts.filter(d => d.id !== id);
    this._save();
  },
  payDebt(id, destination) {
    const debt = this._data.debts.find(d => d.id === id);
    if (!debt || debt.isPaid) return 0;
    const amount = debt.amount;
    debt.isPaid = true;
    debt.paidDate = new Date().toISOString().split('T')[0];
    debt.paidTo = destination;
    if (destination === 'checkingBase') {
      this._data.checkingBaseBalance = (this._data.checkingBaseBalance || 0) + amount;
      this._data.checkingBalance = this._data.checkingBalance !== null ? this._data.checkingBalance + amount : null;
    } else if (destination === 'checkingFree') {
      this._data.checkingBalance = this._data.checkingBalance !== null ? this._data.checkingBalance + amount : null;
    } else if (destination === 'savings') {
      this._data.savingsBalance = (this._data.savingsBalance || 0) + amount;
    }
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 8),
      date: debt.paidDate, month: Store.getCurrentMonth(),
      type: 'Ingreso', category: 'Deuda cobrada',
      amount, description: `Cobrado a ${debt.person}${debt.description ? ': ' + debt.description : ''}`,
      paymentMethod: 'Transferencia',
      account: destination === 'savings' ? 'savings' : 'checking',
      _noAutoBalance: true,   // balance updated above directly
    };
    this._data.transactions.push(tx);
    this._save();
    return amount;
  },

  exportJSON() {
    const d = JSON.parse(JSON.stringify(this._data));
    d._exportedAt = new Date().toISOString();
    return JSON.stringify(d, null, 2);
  },

  importJSON(jsonStr) {
    const d = JSON.parse(jsonStr);
    if (!d || !d.transactions) throw new Error('Datos inválidos');
    this._backup('pre-import');
    this._data = d;
    this._migrate();
    this._save();
    return true;
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

  /** Returns true if a transaction is a balance-sync adjustment (not a real income/expense). */
  isAdjustment(t) { return t.category === '__ajuste__'; },

  /** Transactions visible in financial reports (excludes adjustments and internal system ops). */
  getReportableTransactions() {
    return this._data.transactions.filter(t => !this.isAdjustment(t));
  },

  validateData() {
    const d = this._data;
    if (!d || typeof d !== 'object') return 'No hay datos';
    if (!Array.isArray(d.transactions)) return 'transactions debe ser un array';
    if (!Array.isArray(d.categories)) return 'categories debe ser un array';
    if (!Array.isArray(d.types)) return 'types debe ser un array';
    for (const t of d.transactions) {
      if (!t.id || !t.date || typeof t.amount !== 'number' || !t.type || !t.category) {
        return `Transacción inválida: ${t.id || 'sin id'}`;
      }
    }
    return null;
  },
};
