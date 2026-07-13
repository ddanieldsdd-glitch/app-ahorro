/**
 * MovementForm — shared form builder for adding transactions.
 * Used by QuickAdd FAB (app.js), Registro tab, and Calendario modal.
 *
 * Usage:
 *   MovementForm.buildHTML({ cats, methods, defaultType, defaultDate, defaultAccount, prefix })
 *   MovementForm.getValues(prefix)   → { date, amount, desc, type, category, method, account }
 *   MovementForm.validate(values)    → '' | error string
 */
const MovementForm = {
  buildHTML({ cats = [], methods = [], defaultType = 'Gasto', defaultDate = '', defaultAccount = 'checking', prefix = 'mf' } = {}) {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    return `
      <div class="mf-type-row">
        <button type="button" class="mf-type-btn ${defaultType === 'Gasto' ? 'active expense' : ''}" data-mf-type="Gasto"
          onclick="MovementForm._setType('${prefix}','Gasto')">💸 Gasto</button>
        <button type="button" class="mf-type-btn ${defaultType === 'Ingreso' ? 'active income' : ''}" data-mf-type="Ingreso"
          onclick="MovementForm._setType('${prefix}','Ingreso')">💰 Ingreso</button>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="${prefix}Date" value="${today}">
        </div>
        <div class="form-group">
          <label>Importe (€)</label>
          <input type="number" id="${prefix}Amount" placeholder="0.00" step="0.01" min="0.01" inputmode="decimal">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Descripción</label>
          <input type="text" id="${prefix}Desc" placeholder="Descripción opcional" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="${prefix}Category">
            ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Método de pago</label>
          <select id="${prefix}Method" onchange="MovementForm._syncAccount('${prefix}')">
            ${methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label>Cuenta</label>
          <select id="${prefix}Account">
            <option value="checking" ${defaultAccount === 'checking' ? 'selected' : ''}>💳 Corriente</option>
            <option value="savings" ${defaultAccount === 'savings' ? 'selected' : ''}>🐷 Ahorro</option>
            <option value="cash" ${defaultAccount === 'cash' ? 'selected' : ''}>💵 Efectivo (no computa)</option>
          </select>
        </div>
      </div>
      <div id="${prefix}BudgetHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px"></div>
      <input type="hidden" id="${prefix}Type" value="${defaultType}">
    `;
  },

  getValues(prefix = 'mf') {
    return {
      date: document.getElementById(`${prefix}Date`)?.value || '',
      amount: parseFloat(document.getElementById(`${prefix}Amount`)?.value) || 0,
      desc: document.getElementById(`${prefix}Desc`)?.value.trim() || '',
      type: document.getElementById(`${prefix}Type`)?.value || 'Gasto',
      category: document.getElementById(`${prefix}Category`)?.value || '',
      method: document.getElementById(`${prefix}Method`)?.value || '',
      account: document.getElementById(`${prefix}Account`)?.value || 'checking',
    };
  },

  validate({ date, amount }) {
    if (!date) return 'La fecha es obligatoria';
    if (!amount || amount <= 0) return 'El importe debe ser mayor que 0';
    return '';
  },

  _setType(prefix, type) {
    document.getElementById(`${prefix}Type`).value = type;
    const btns = document.querySelectorAll(`[data-mf-type]`);
    btns.forEach(b => {
      b.classList.remove('active', 'income', 'expense');
      if (b.dataset.mfType === type) b.classList.add('active', type === 'Ingreso' ? 'income' : 'expense');
    });
  },

  _syncAccount(prefix) {
    const method = document.getElementById(`${prefix}Method`)?.value;
    const acc = document.getElementById(`${prefix}Account`);
    if (!acc) return;
    if (method === 'Efectivo') acc.value = 'cash';
    else if (acc.value === 'cash') acc.value = 'checking';
  },

  /** Auto-suggest round-up and budget hint while user types. */
  checkBudget(prefix) {
    const amount = parseFloat(document.getElementById(`${prefix}Amount`)?.value);
    const category = document.getElementById(`${prefix}Category`)?.value;
    const type = document.getElementById(`${prefix}Type`)?.value;
    const hint = document.getElementById(`${prefix}BudgetHint`);
    if (!hint) return;
    if (!amount || amount <= 0 || type !== 'Gasto') { hint.style.display = 'none'; return; }
    const limits = Store.getCategoryLimits();
    const limit = category ? limits[category] : 0;
    if (limit > 0) {
      const month = Store.getCurrentMonth();
      const spent = Store.getTransactions().filter(t => t.month === month && t.category === category && t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
      const projected = spent + amount;
      if (projected > limit) {
        hint.style.display = 'block';
        hint.style.background = '#FEE2E2'; hint.style.color = '#991B1B';
        hint.textContent = `⚠️ Superarás el límite de ${category} (${limit.toFixed(0)} €). Ya gastaste ${spent.toFixed(2)} €.`;
        return;
      }
    }
    hint.style.display = 'none';
  },
};
