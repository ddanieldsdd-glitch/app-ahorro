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
  // Quick emoji palette for picker
  _EMOJI_PALETTE: ['😀','🎉','🛒','🍔','🍕','☕','🚗','🏠','💊','📚','👗','🎮','✈️','🎁','💪','🌟','🔧','📱','🎵','🏋️','🐷','💸','🆘','⚠️','✅','❤️','🌈','🔑','📋','💡'],

  buildHTML({ cats = [], methods = [], defaultType = 'Gasto', defaultDate = '', defaultAccount = 'checking', prefix = 'mf', showTraspaso = true } = {}) {
    const today = defaultDate || new Date().toISOString().split('T')[0];
    return `
      <div class="mf-type-row">
        <button type="button" class="mf-type-btn ${defaultType === 'Gasto' ? 'active expense' : ''}" data-mf-type="Gasto"
          onclick="MovementForm._setType('${prefix}','Gasto')">💸 Gasto</button>
        <button type="button" class="mf-type-btn ${defaultType === 'Ingreso' ? 'active income' : ''}" data-mf-type="Ingreso"
          onclick="MovementForm._setType('${prefix}','Ingreso')">💰 Ingreso</button>
        ${showTraspaso ? `<button type="button" class="mf-type-btn ${defaultType === 'Traspaso' ? 'active' : ''}" data-mf-type="Traspaso"
          onclick="MovementForm._setType('${prefix}','Traspaso')" style="${defaultType === 'Traspaso' ? 'background:linear-gradient(135deg,#4F46E5,#10B981);color:#fff;border-color:transparent' : ''}">⇄ Traspaso</button>` : ''}
      </div>
      <div id="${prefix}TransferTypeRow" style="${defaultType === 'Traspaso' ? '' : 'display:none'};margin-bottom:8px">
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Tipo de traspaso</label>
        <div style="display:flex;gap:6px">
          <button type="button" id="${prefix}TransferTo" class="mf-type-btn active" style="flex:1;background:linear-gradient(135deg,#4F46E5,#10B981);color:#fff;border:none;font-size:12px"
            onclick="MovementForm._setTransferType('${prefix}','to_savings')">💸→🐷 Corriente → Ahorro</button>
          <button type="button" id="${prefix}TransferFrom" class="mf-type-btn" style="flex:1;font-size:12px"
            onclick="MovementForm._setTransferType('${prefix}','from_savings_emergency')">🆘 Ahorro → Corriente (imprevisto)</button>
        </div>
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
        <div id="${prefix}CategoryRow" class="form-group" style="${defaultType === 'Traspaso' ? 'display:none' : ''}">
          <label>Categoría</label>
          <select id="${prefix}Category">
            ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div id="${prefix}MethodRow" class="form-group" style="${defaultType === 'Traspaso' ? 'display:none' : ''}">
          <label>Método de pago</label>
          <select id="${prefix}Method" onchange="MovementForm._onMethodChange('${prefix}')">
            ${methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
            <option value="__add__">+ Añadir nuevo...</option>
          </select>
        </div>
        <div id="${prefix}AccountRow" class="form-group" style="grid-column:1/-1;${defaultType === 'Traspaso' ? 'display:none' : ''}">
          <label>Cuenta</label>
          <select id="${prefix}Account">
            <option value="checking" ${defaultAccount === 'checking' ? 'selected' : ''}>💳 Corriente</option>
            <option value="savings" ${defaultAccount === 'savings' ? 'selected' : ''}>🐷 Ahorro</option>
            <option value="cash" ${defaultAccount === 'cash' ? 'selected' : ''}>💵 Efectivo</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;align-items:center;gap:6px">
            Emoticono <span style="font-size:10px;color:var(--text-secondary)">(opcional)</span>
          </label>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="text" id="${prefix}Emoji" placeholder="😀" style="width:48px;text-align:center;font-size:20px;padding:4px;border:1px solid var(--border);border-radius:6px">
            <div style="display:flex;flex-wrap:wrap;gap:3px;max-width:240px">
              ${this._EMOJI_PALETTE.slice(0,15).map(e => `<button type="button" onclick="document.getElementById('${prefix}Emoji').value='${e}'" style="font-size:16px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 4px;line-height:1">${e}</button>`).join('')}
              <button type="button" onclick="MovementForm._toggleMoreEmoji('${prefix}')" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 4px;color:var(--primary)">+más</button>
            </div>
          </div>
          <div id="${prefix}MoreEmoji" style="display:none;flex-wrap:wrap;gap:3px;margin-top:4px">
            ${this._EMOJI_PALETTE.slice(15).map(e => `<button type="button" onclick="document.getElementById('${prefix}Emoji').value='${e}'" style="font-size:16px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 4px;line-height:1">${e}</button>`).join('')}
          </div>
        </div>
      </div>
      <div id="${prefix}BudgetHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px"></div>
      <input type="hidden" id="${prefix}Type" value="${defaultType}">
      <input type="hidden" id="${prefix}TransferType" value="to_savings">
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
      emoji: document.getElementById(`${prefix}Emoji`)?.value.trim() || '',
      transferType: document.getElementById(`${prefix}TransferType`)?.value || 'to_savings',
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
      b.style.background = '';
      b.style.color = '';
      b.style.borderColor = '';
      if (b.dataset.mfType === type) {
        b.classList.add('active');
        if (type === 'Ingreso') b.classList.add('income');
        else if (type === 'Gasto') b.classList.add('expense');
        else if (type === 'Traspaso') {
          b.style.background = 'linear-gradient(135deg,#4F46E5,#10B981)';
          b.style.color = '#fff';
          b.style.borderColor = 'transparent';
        }
      }
    });
    const isTraspaso = type === 'Traspaso';
    const transferRow = document.getElementById(`${prefix}TransferTypeRow`);
    const catRow = document.getElementById(`${prefix}CategoryRow`);
    const methodRow = document.getElementById(`${prefix}MethodRow`);
    const accountRow = document.getElementById(`${prefix}AccountRow`);
    if (transferRow) transferRow.style.display = isTraspaso ? '' : 'none';
    if (catRow) catRow.style.display = isTraspaso ? 'none' : '';
    if (methodRow) methodRow.style.display = isTraspaso ? 'none' : '';
    if (accountRow) accountRow.style.display = isTraspaso ? 'none' : '';
    if (!isTraspaso) this._refreshCategories(prefix, type);
  },

  _setTransferType(prefix, ttype) {
    const hidden = document.getElementById(`${prefix}TransferType`);
    if (hidden) hidden.value = ttype;
    const btnTo = document.getElementById(`${prefix}TransferTo`);
    const btnFrom = document.getElementById(`${prefix}TransferFrom`);
    if (!btnTo || !btnFrom) return;
    if (ttype === 'to_savings') {
      btnTo.style.background = 'linear-gradient(135deg,#4F46E5,#10B981)';
      btnTo.style.color = '#fff';
      btnTo.style.border = 'none';
      btnFrom.style.background = '';
      btnFrom.style.color = '';
      btnFrom.style.border = '';
    } else {
      btnFrom.style.background = 'linear-gradient(135deg,#EC4899,#EF4444)';
      btnFrom.style.color = '#fff';
      btnFrom.style.border = 'none';
      btnTo.style.background = '';
      btnTo.style.color = '';
      btnTo.style.border = '';
    }
  },

  _toggleMoreEmoji(prefix) {
    const el = document.getElementById(`${prefix}MoreEmoji`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  },

  _refreshCategories(prefix, type, selected) {
    const sel = document.getElementById(`${prefix}Category`);
    if (!sel) return;
    const cats = Store.getCategoriesForType(type);
    const current = selected || sel.value;
    const defaultCat = type === 'Ingreso'
      ? (cats.includes('Mensualidad') ? 'Mensualidad' : cats[0])
      : (cats.includes('Comida') ? 'Comida' : cats[0]);
    const pick = cats.includes(current) ? current : defaultCat;
    sel.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === pick ? 'selected' : ''}>${esc(c)}</option>`).join('');
    const addOpt = document.createElement('option');
    addOpt.value = '__add__'; addOpt.textContent = '+ Añadir nuevo...';
    sel.appendChild(addOpt);
    sel.onchange = (e) => {
      if (e.target.value !== '__add__') return;
      const label = type === 'Ingreso' ? 'categoría de ingreso' : 'categoría de gasto';
      const prev = pick;
      App.showPrompt(`Nueva ${label}`, 'Nombre:', '', (name) => {
        if (!name) { sel.value = prev; return; }
        if (type === 'Ingreso') Store.addIncomeCategory(name);
        else Store.addCategory(name);
        this._refreshCategories(prefix, type, name);
        App._refreshConfigDependents?.();
      });
      sel.value = prev;
    };
  },

  _onMethodChange(prefix) {
    const sel = document.getElementById(`${prefix}Method`);
    if (sel?.value === '__add__') {
      const prev = sel.dataset.prev || Store.getPaymentMethods()[0];
      App.showPrompt('Nuevo método de pago', 'Nombre:', '', (name) => {
        if (!name) { sel.value = prev; return; }
        Store.addPaymentMethod(name);
        sel.innerHTML = Store.getPaymentMethods().map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('') +
          '<option value="__add__">+ Añadir nuevo...</option>';
        sel.value = name;
        App._refreshConfigDependents?.();
      });
      sel.value = prev;
      return;
    }
    sel.dataset.prev = sel.value;
    this._syncAccount(prefix);
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

    // Use weekly window via BudgetEngine (limits are weekly, not monthly)
    const result = BudgetEngine.checkCategoryLimit(category, amount);
    if (result && result.level !== 'good') {
      hint.style.display = 'block';
      const isOver = result.level === 'danger';
      hint.style.background = isOver ? '#FEE2E2' : '#FFFBEB';
      hint.style.color = isOver ? '#991B1B' : '#B45309';
      const icon = isOver ? '🔴' : result.level === 'warning' ? '🟡' : '⚠️';
      hint.textContent = `${icon} ${isOver ? 'Superarás' : 'Te acercas al'} límite semanal de ${category} (${result.limit.toFixed(0)} €/sem). Gastado: ${result.alreadySpent.toFixed(2)} € → Proyección: ${result.projected.toFixed(2)} €`;
      return;
    }
    hint.style.display = 'none';
  },
};
