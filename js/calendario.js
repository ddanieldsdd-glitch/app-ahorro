const Calendario = {
  _viewYear: null,
  _viewMonth: null,

  _subscribed: false,

  render() {
    const el = document.getElementById('tab-calendario');
    // Subscribe once so any local save refreshes the calendar if it's the active tab
    if (!this._subscribed) {
      this._subscribed = true;
      Store.onSave(() => {
        const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
        if (activeTab === 'calendario') this.render();
      });
    }
    const [cy, cm] = App.getCurrentViewMonth().split('-').map(Number);
    if (this._viewYear === null) {
      this._viewYear = cy;
      this._viewMonth = cm - 1;
    }

    const monthKey = `${this._viewYear}-${String(this._viewMonth + 1).padStart(2, '0')}`;
    const transactions = this._getMonthTransactions(monthKey);
    const daily = this._buildDailyMap(transactions);
    const planned = Store.getPlannedExpenses().filter(p => p.targetDate?.startsWith(monthKey));
    const recurring = Store.getRecurringTransactions().filter(r => r.active);
    const today = new Date().toISOString().split('T')[0];

    const monthIncome = transactions.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const monthExpense = transactions.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const monthBalance = monthIncome - monthExpense;

    el.innerHTML = `
      <div class="card cal-card">
        <div class="cal-header">
          <button class="btn btn-secondary btn-sm cal-nav" onclick="Calendario._prevMonth()" title="Mes anterior">◀</button>
          <div class="cal-title-wrap">
            <span class="cal-title">${MONTHS[this._viewMonth]} ${this._viewYear}</span>
            ${monthKey !== App.getCurrentViewMonth() ? `<button class="btn-sm cal-today-btn" onclick="Calendario._goToday()">Hoy</button>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm cal-nav" onclick="Calendario._nextMonth()" title="Mes siguiente">▶</button>
        </div>
        <div class="cal-summary">
          <div class="cal-sum-item"><span class="cal-sum-label income">Ingresos</span><strong class="income">+${monthIncome.toFixed(0)} €</strong></div>
          <div class="cal-sum-item"><span class="cal-sum-label expense">Gastos</span><strong class="expense">-${monthExpense.toFixed(0)} €</strong></div>
          <div class="cal-sum-item"><span class="cal-sum-label">Balance</span><strong style="color:${monthBalance >= 0 ? 'var(--income)' : 'var(--expense)'}">${monthBalance >= 0 ? '+' : ''}${monthBalance.toFixed(0)} €</strong></div>
        </div>
        <div class="cal-weekdays">
          ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => `<span>${d}</span>`).join('')}
        </div>
        <div class="cal-grid" id="calGrid">${this._renderDays(daily, planned, recurring, today, monthKey)}</div>
        <div class="cal-legend">
          <span><i class="cal-dot cal-dot-pos"></i> Positivo</span>
          <span><i class="cal-dot cal-dot-neg"></i> Negativo</span>
          <span><i class="cal-dot cal-dot-rem"></i> Recordatorio</span>
          <span style="display:inline-flex;align-items:center;gap:3px;font-size:11px">🐷 Ahorro día ${Store.getSavingsDay()} <button style="border:none;background:none;cursor:pointer;font-size:10px;color:var(--primary);padding:0" onclick="Calendario._configureSavingsDay()">✏️</button></span>
          <span class="tip-hint" data-tip="Toca un día para ver el detalle o añadir un gasto/ingreso. En días futuros puedes planificar movimientos.">ℹ️ Ayuda</span>
        </div>
      </div>
      ${planned.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔔 Recordatorios del mes</span>
          <span style="font-size:11px;color:var(--text-secondary)">${planned.length} gasto${planned.length !== 1 ? 's' : ''}</span>
        </div>
        ${planned.sort((a, b) => a.targetDate.localeCompare(b.targetDate)).map(p => `
          <div class="cal-reminder" onclick="Calendario._showDay('${p.targetDate}')">
            <span class="cal-rem-date">${p.targetDate.split('-').reverse().join('/')}</span>
            <span class="cal-rem-name">${esc(p.name)}</span>
            <span class="cal-rem-amt">${p.amount.toFixed(0)} €</span>
          </div>`).join('')}
      </div>` : ''}
    `;
  },

  _renderDays(daily, planned, recurring, today, monthKey) {
    const first = new Date(this._viewYear, this._viewMonth, 1);
    const lastDay = new Date(this._viewYear, this._viewMonth + 1, 0).getDate();
    let startDow = first.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const savingsDay = Store.getSavingsDay();
    const imprevistosBudget = Store.getImprevistosBudget();

    let html = '';
    for (let i = 0; i < startDow; i++) {
      html += '<div class="cal-day cal-day-empty"></div>';
    }

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${this._viewYear}-${String(this._viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const data = daily[dateStr] || { income: 0, expense: 0, txs: [] };
      const balance = data.income - data.expense;
      const isToday = dateStr === today;
      const isFuture = dateStr > today;
      const isOtherMonth = !dateStr.startsWith(monthKey);
      const hasTx = data.txs.length > 0;
      const dayPlanned = planned.filter(p => p.targetDate === dateStr);
      const dayRecurring = recurring.filter(r => {
        if (r.frequency === 'monthly') return (r.dayOfMonth || 1) === day;
        if (r.frequency === 'weekly') {
          const d = new Date(dateStr + 'T12:00:00');
          const dow = d.getDay();
          return dow === (r.dayOfWeek ?? 1);
        }
        return r.nextDate === dateStr;
      });

      let balClass = 'cal-bal-neutral';
      if (balance > 0) balClass = 'cal-bal-pos';
      else if (balance < 0) balClass = 'cal-bal-neg';

      const reminders = dayPlanned.length + dayRecurring.length;
      const isSavingsDay = day === savingsDay;
      const isImprevistoDay = imprevistosBudget > 0 && day === savingsDay;

      const tipExtras = [];
      if (isSavingsDay) tipExtras.push('🐷 Día de ahorro mensual');
      if (isImprevistoDay) tipExtras.push('⚠️ Reserva imprevistos');
      const tip = hasTx
        ? `Ingresos: ${data.income.toFixed(2)}€ · Gastos: ${data.expense.toFixed(2)}€ · Balance: ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€${tipExtras.length ? ' · ' + tipExtras.join(' · ') : ''}`
        : tipExtras.length ? tipExtras.join(' · ')
        : isFuture ? 'Toca para añadir un movimiento planificado' : 'Toca para ver o añadir un movimiento';

      html += `<button type="button" class="cal-day ${isToday ? 'cal-day-today' : ''} ${isFuture ? 'cal-day-future' : ''} ${hasTx ? 'cal-day-has-tx' : ''} ${isOtherMonth ? 'cal-day-other' : ''} ${isSavingsDay ? 'cal-day-savings' : ''}"
        onclick="Calendario._onDayClick('${dateStr}')"
        title="${tip}"
        aria-label="${day} de ${MONTHS[this._viewMonth]}">
        <span class="cal-day-num">${day}</span>
        ${hasTx ? `<div class="cal-day-totals">
          ${data.income > 0 ? `<span class="cal-inc">+${data.income >= 100 ? Math.round(data.income) : data.income.toFixed(0)}</span>` : ''}
          ${data.expense > 0 ? `<span class="cal-exp">-${data.expense >= 100 ? Math.round(data.expense) : data.expense.toFixed(0)}</span>` : ''}
        </div>` : ''}
        ${hasTx ? `<span class="cal-bal-bar ${balClass}"></span>` : ''}
        ${isSavingsDay ? `<span class="cal-savings-icon" title="${isImprevistoDay ? 'Ahorro + imprevistos' : 'Día de ahorro'}">🐷${isImprevistoDay ? '⚠️' : ''}</span>` : ''}
        ${dayRecurring.length > 0 && isFuture ? `<span class="cal-rec-dot" title="${dayRecurring.map(r => r.name || r.category).join(', ')}">🔁</span>` : ''}
        ${dayPlanned.length > 0 && reminders > 0 ? `<span class="cal-rem-dot" title="${dayPlanned.map(p => p.name).join(', ')}"></span>` : ''}
        ${dayRecurring.length > 0 && !isFuture ? `<span class="cal-rem-dot" title="${dayRecurring.length} recurrente${dayRecurring.length !== 1 ? 's' : ''}"></span>` : ''}
      </button>`;
    }
    return html;
  },

  _getMonthTransactions(monthKey) {
    if (App.isViewingArchived()) {
      return (Store.getArchivedMonth(monthKey) || []).filter(t => t.month === monthKey);
    }
    return Store.getTransactions().filter(t => t.month === monthKey);
  },

  _buildDailyMap(transactions) {
    const map = {};
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, txs: [] };
      if (t.type === 'Ingreso') map[t.date].income += t.amount;
      else map[t.date].expense += t.amount;
      map[t.date].txs.push(t);
    }
    return map;
  },

  _prevMonth() {
    this._viewMonth--;
    if (this._viewMonth < 0) { this._viewMonth = 11; this._viewYear--; }
    this.render();
  },

  _nextMonth() {
    this._viewMonth++;
    if (this._viewMonth > 11) { this._viewMonth = 0; this._viewYear++; }
    this.render();
  },

  _goToday() {
    const now = new Date();
    this._viewYear = now.getFullYear();
    this._viewMonth = now.getMonth();
    this.render();
  },

  _onDayClick(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    if (App.isViewingArchived()) {
      this._showDay(dateStr);
      return;
    }
    if (dateStr > today) {
      this._openAddForm(dateStr);
      return;
    }
    const txs = Store.getTransactions().filter(t => t.date === dateStr);
    if (txs.length === 0) {
      this._openAddForm(dateStr);
    } else {
      this._showDay(dateStr);
    }
  },

  _showDay(dateStr) {
    const monthKey = dateStr.substring(0, 7);
    let txs = [];
    if (App.isViewingArchived() && monthKey !== Store.getCurrentMonth()) {
      txs = (Store.getArchivedMonth(monthKey) || []).filter(t => t.date === dateStr);
    } else {
      txs = Store.getTransactions().filter(t => t.date === dateStr);
    }
    const planned = Store.getPlannedExpenses().filter(p => p.targetDate === dateStr);
    const income = txs.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    const isArchived = App.isViewingArchived();
    const txHtml = txs.length === 0
      ? '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px">Sin movimientos este día</p>'
      : txs.sort((a, b) => (a.type === 'Ingreso' ? -1 : 1)).map(t => `
        <div class="cal-tx-row" id="cal-tx-${t.id}">
          <span class="cal-tx-icon ${t.type === 'Ingreso' ? 'income' : 'expense'}">${t.type === 'Ingreso' ? '↑' : '↓'}</span>
          <div class="cal-tx-info">
            <div class="cal-tx-desc">${esc(t.description || t.category)}</div>
            <div class="cal-tx-meta">${esc(t.category)}${t.paymentMethod ? ' · ' + esc(t.paymentMethod) : ''}</div>
          </div>
          <span class="cal-tx-amt ${t.type === 'Ingreso' ? 'income' : 'expense'}">${t.type === 'Ingreso' ? '+' : '-'}${t.amount.toFixed(2)}€</span>
          ${!isArchived ? `<div class="cal-tx-actions">
            <button title="Editar" onclick="Calendario._editFromCalendar('${t.id}','${dateStr}')">✏️</button>
            <button title="Eliminar" onclick="Calendario._deleteFromCalendar('${t.id}','${dateStr}')">🗑️</button>
          </div>` : ''}
        </div>`).join('');

    const plannedHtml = planned.length > 0 ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">🔔 Gastos planificados</div>
        ${planned.map(p => `<div class="cal-tx-row"><span>📋</span><span>${esc(p.name)}</span><strong>${p.amount.toFixed(2)} €</strong></div>`).join('')}
      </div>` : '';

    App.showCustom(`📅 ${label}`,
      `<div class="cal-day-summary">
        <div><span>Ingresos</span><strong class="income">+${income.toFixed(2)} €</strong></div>
        <div><span>Gastos</span><strong class="expense">-${expense.toFixed(2)} €</strong></div>
        <div><span>Balance</span><strong style="color:${balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${balance >= 0 ? '+' : ''}${balance.toFixed(2)} €</strong></div>
      </div>
      ${txHtml}${plannedHtml}
      ${!isArchived ? `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px" onclick="App._closeModal();Calendario._openAddForm('${dateStr}')">➕ Añadir movimiento</button>` : ''}`,
      'Cerrar', () => App._closeModal()
    );
  },

  _editFromCalendar(id, dateStr) {
    const t = Store.getTransactions().find(tx => tx.id === id);
    if (!t) return;

    const expenseCats = Store.getCategories();
    const incomeCats  = Store.getIncomeCategories();
    const methods     = Store.getPaymentMethods();
    const cats        = t.type === 'Ingreso' ? incomeCats : expenseCats;

    App.openModal({
      title: '✏️ Editar movimiento',
      body: `
        <div class="form-group"><label>Importe (€)</label>
          <input type="number" id="calEditAmount" step="0.01" min="0.01" value="${t.amount}" style="font-size:18px;font-weight:700;width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group"><label>Descripción</label>
          <input type="text" id="calEditDesc" value="${esc(t.description || '')}" maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group"><label>Categoría</label>
          <select id="calEditCategory" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            ${cats.map(c => `<option value="${esc(c)}"${c === t.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Método de pago</label>
          <select id="calEditMethod" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            ${methods.map(m => `<option value="${esc(m)}"${m === t.paymentMethod ? ' selected' : ''}>${esc(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Cuenta</label>
          <select id="calEditAccount" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            <option value="checking"${t.account === 'checking' ? ' selected' : ''}>💳 Corriente</option>
            <option value="savings"${t.account === 'savings' ? ' selected' : ''}>🐷 Ahorro</option>
            <option value="cash"${t.account === 'cash' ? ' selected' : ''}>💵 Efectivo (no computa)</option>
          </select>
        </div>`,
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const amount   = parseFloat(document.getElementById('calEditAmount')?.value);
          const desc     = document.getElementById('calEditDesc')?.value.trim();
          const category = document.getElementById('calEditCategory')?.value;
          const method   = document.getElementById('calEditMethod')?.value;
          const account  = document.getElementById('calEditAccount')?.value;
          if (!amount || amount <= 0) { App.showToast('Importe inválido'); return; }
          Store.updateTransaction(id, { amount, description: desc, category, paymentMethod: method, account });
          Calendario.render();
          if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
          Dashboard.render(); Presupuesto.render(); Graficos.render();
          App.showToast('Movimiento actualizado');
          setTimeout(() => Calendario._showDay(dateStr), 100);
        }},
      ],
    });
  },

  _deleteFromCalendar(id, dateStr) {
    const t = Store.getTransactions().find(tx => tx.id === id);
    if (!t) return;
    App.showConfirm('Eliminar', `¿Eliminar "${esc(t.description || t.category)}" (${t.amount.toFixed(2)} €)?`, () => {
      Store.deleteTransaction(id);
      Calendario.render();
      if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
      Dashboard.render(); Presupuesto.render(); Graficos.render();
      App.showToast('Movimiento eliminado');
      const remaining = Store.getTransactions().filter(tx => tx.date === dateStr);
      if (remaining.length > 0) setTimeout(() => Calendario._showDay(dateStr), 100);
    });
  },

  _openAddForm(dateStr) {
    if (App.isViewingArchived()) {
      App.showToast('No puedes añadir movimientos en meses archivados');
      return;
    }

    const expenseCats = Store.getCategories();
    const methods = Store.getPaymentMethods();
    const frequentExpense = Store.getFrequentCategories(4);
    const frequentIncome = Store.getFrequentIncomeCategories(4);

    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    App.showCustom(`➕ Movimiento · ${label}`,
      `<div style="display:flex;gap:6px;margin-bottom:10px">
        <button type="button" class="cal-type-btn active" data-cal-type="Gasto" onclick="Calendario._setType('Gasto')">💸 Gasto</button>
        <button type="button" class="cal-type-btn" data-cal-type="Ingreso" onclick="Calendario._setType('Ingreso')">💰 Ingreso</button>
        <button type="button" class="cal-type-btn" data-cal-type="Traspaso" onclick="Calendario._setType('Traspaso')">⇄ Traspaso</button>
      </div>
      <div class="form-group"><label>Importe (€)</label>
        <input type="number" id="calAmount" step="0.01" min="0.01" placeholder="0.00" style="font-size:18px;font-weight:700;width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group"><label>Descripción</label>
        <input type="text" id="calDesc" placeholder="¿Concepto?" maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group"><label>Categoría</label>
        <select id="calCategory" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          ${expenseCats.map(c => `<option value="${esc(c)}" ${c === (frequentExpense[0] || 'Comida') ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <div class="cal-cat-chips" id="calCatChips"><span style="font-size:11px;color:var(--text-secondary)">Frecuentes:</span></div>
      </div>
      <div class="form-group"><label>Método de pago</label>
        <select id="calMethod" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"
          onchange="Calendario._syncAccountFromMethod()">
          ${methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Cuenta</label>
        <select id="calAccount" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          <option value="checking">💳 Corriente</option>
          <option value="savings">🐷 Ahorro</option>
          <option value="cash">💵 Efectivo (no computa)</option>
        </select>
      </div>
      <input type="hidden" id="calDate" value="${dateStr}">`,
      '➕ Añadir', () => {
        const amount = parseFloat(document.getElementById('calAmount').value);
        const desc = document.getElementById('calDesc').value.trim();
        const category = document.getElementById('calCategory').value;
        const method = document.getElementById('calMethod').value;
        const account = document.getElementById('calAccount')?.value || 'checking';
        const type = document.querySelector('.cal-type-btn.active')?.dataset?.calType || 'Gasto';
        const date = document.getElementById('calDate').value;
        if (!amount || amount <= 0 || !date) return;
        if (date !== dateStr) { App.showToast('⚠️ Fecha inválida'); return; }
        const txData = type === 'Traspaso'
          ? { date, amount, description: desc || 'Traspaso a ahorro', type, category: 'Traspaso', paymentMethod: 'Transferencia', account: 'checking' }
          : { date, amount, description: desc, type, category, paymentMethod: method, account };
        Store.addTransaction(txData);
        if (type === 'Ingreso') {
          App.suggestSavings(amount);
        }
        App._refreshAll();
        this.render();
        App.showToast(`✅ ${type} añadido`);
        // Reopen day view so user can keep adding movements
        setTimeout(() => Calendario._showDay(dateStr), 80);
      }
    );
    setTimeout(() => {
      document.getElementById('calAmount')?.focus();
      Calendario._renderCatChips('Gasto', frequentExpense, frequentIncome);
    }, 80);
  },

  _renderCatChips(type, frequentExpense, frequentIncome) {
    const chipsEl = document.getElementById('calCatChips');
    if (!chipsEl) return;
    const frequent = type === 'Ingreso' ? frequentIncome : frequentExpense;
    const label = type === 'Ingreso' ? 'Frecuentes:' : 'Frecuentes:';
    chipsEl.innerHTML = frequent.length > 0
      ? `<span style="font-size:11px;color:var(--text-secondary)">${label}</span>${frequent.map(c =>
          `<button type="button" class="cal-cat-chip" onclick="document.getElementById('calCategory').value='${esc(c)}'">${esc(c)}</button>`
        ).join('')}`
      : '';
  },

  _setType(type) {
    document.querySelectorAll('.cal-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.calType === type);
    });
    // For Traspaso, hide category/method/account fields
    const catGroup    = document.getElementById('calCategory')?.closest('.form-group');
    const methodGroup = document.getElementById('calMethod')?.closest('.form-group');
    const accountGroup = document.getElementById('calAccount')?.closest('.form-group');
    const isTraspaso = type === 'Traspaso';
    if (catGroup)    catGroup.style.display    = isTraspaso ? 'none' : '';
    if (methodGroup) methodGroup.style.display = isTraspaso ? 'none' : '';
    if (accountGroup) accountGroup.style.display = isTraspaso ? 'none' : '';
    const descInput = document.getElementById('calDesc');
    if (descInput && isTraspaso && !descInput.value) descInput.value = 'Traspaso a ahorro';
    if (isTraspaso) return;
    const sel = document.getElementById('calCategory');
    if (!sel) return;
    const cats = Store.getCategoriesForType(type);
    const defaultCat = type === 'Ingreso'
      ? (cats.includes('Mensualidad') ? 'Mensualidad' : cats[0])
      : (cats.includes('Comida') ? 'Comida' : cats[0]);
    const current = sel.value;
    const pick = cats.includes(current) ? current : defaultCat;
    sel.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === pick ? 'selected' : ''}>${esc(c)}</option>`).join('');
    this._renderCatChips(type, Store.getFrequentCategories(4), Store.getFrequentIncomeCategories(4));
  },

  _syncAccountFromMethod() {
    const method = document.getElementById('calMethod')?.value;
    const acc = document.getElementById('calAccount');
    if (!acc) return;
    if (method === 'Efectivo') acc.value = 'cash';
    else if (acc.value === 'cash') acc.value = 'checking';
  },

  _configureSavingsDay() {
    const current = Store.getSavingsDay();
    const imprevistosBudget = Store.getImprevistosBudget();
    App.showCustom('🐷 Día mensual de ahorro', `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">
        El día del mes en que debes hacer tu transferencia de ahorro${imprevistosBudget > 0 ? ' y reservar imprevistos' : ''}.
        Aparecerá marcado en el calendario.
      </p>
      <div class="form-group">
        <label>Día del mes (1-28)</label>
        <input type="number" id="savingsDayInput" value="${current}" min="1" max="28" step="1"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Máximo día 28 para que sea válido todos los meses.</div>
      </div>
    `, 'Guardar', () => {
      const v = parseInt(document.getElementById('savingsDayInput')?.value, 10);
      if (v >= 1 && v <= 28) {
        Store.setSavingsDay(v);
        this.render();
        App.showToast(`✅ Día de ahorro configurado: día ${v} de cada mes`);
      }
    });
    setTimeout(() => {
      const inp = document.getElementById('savingsDayInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 80);
  },

  resetView() {
    const [cy, cm] = App.getCurrentViewMonth().split('-').map(Number);
    this._viewYear = cy;
    this._viewMonth = cm - 1;
  },
};
