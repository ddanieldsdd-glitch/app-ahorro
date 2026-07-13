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
          <span class="tip-hint" data-tip="Toca un día con movimientos para ver el detalle. En días futuros puedes añadir un gasto o ingreso planificado.">ℹ️ Ayuda</span>
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
      const tip = hasTx
        ? `Ingresos: ${data.income.toFixed(2)}€ · Gastos: ${data.expense.toFixed(2)}€ · Balance: ${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€`
        : isFuture ? 'Toca para añadir un movimiento planificado' : 'Sin movimientos';

      html += `<button type="button" class="cal-day ${isToday ? 'cal-day-today' : ''} ${isFuture ? 'cal-day-future' : ''} ${hasTx ? 'cal-day-has-tx' : ''} ${isOtherMonth ? 'cal-day-other' : ''}"
        onclick="Calendario._onDayClick('${dateStr}')"
        title="${tip}"
        aria-label="${day} de ${MONTHS[this._viewMonth]}">
        <span class="cal-day-num">${day}</span>
        ${hasTx ? `<div class="cal-day-totals">
          ${data.income > 0 ? `<span class="cal-inc">+${data.income >= 100 ? Math.round(data.income) : data.income.toFixed(0)}</span>` : ''}
          ${data.expense > 0 ? `<span class="cal-exp">-${data.expense >= 100 ? Math.round(data.expense) : data.expense.toFixed(0)}</span>` : ''}
        </div>` : ''}
        ${hasTx ? `<span class="cal-bal-bar ${balClass}"></span>` : ''}
        ${reminders > 0 ? `<span class="cal-rem-dot" title="${reminders} recordatorio${reminders !== 1 ? 's' : ''}"></span>` : ''}
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
    if (dateStr > today) {
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

    const txHtml = txs.length === 0
      ? '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px">Sin movimientos este día</p>'
      : txs.sort((a, b) => (a.type === 'Ingreso' ? -1 : 1)).map(t => `
        <div class="cal-tx-row">
          <span class="cal-tx-icon ${t.type === 'Ingreso' ? 'income' : 'expense'}">${t.type === 'Ingreso' ? '↑' : '↓'}</span>
          <div class="cal-tx-info">
            <div class="cal-tx-desc">${esc(t.description || t.category)}</div>
            <div class="cal-tx-meta">${esc(t.category)}${t.paymentMethod ? ' · ' + esc(t.paymentMethod) : ''}</div>
          </div>
          <span class="cal-tx-amt ${t.type === 'Ingreso' ? 'income' : 'expense'}">${t.type === 'Ingreso' ? '+' : '-'}${t.amount.toFixed(2)}€</span>
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
      ${dateStr >= today && !App.isViewingArchived() ? `<button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px" onclick="App._closeModal();Calendario._openAddForm('${dateStr}')">➕ Añadir movimiento</button>` : ''}`,
      'Cerrar', () => App._closeModal()
    );
  },

  _openAddForm(dateStr) {
    if (App.isViewingArchived()) {
      App.showToast('No puedes añadir movimientos en meses archivados');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (dateStr < today) {
      this._showDay(dateStr);
      return;
    }

    const cats = Store.getCategories();
    const methods = Store.getPaymentMethods();
    const frequent = Store.getFrequentCategories(4);
    const freqChips = frequent.map(c =>
      `<button type="button" class="cal-cat-chip" onclick="document.getElementById('calCategory').value='${esc(c)}'">${esc(c)}</button>`
    ).join('');

    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    App.showCustom(`➕ Movimiento · ${label}`,
      `<div style="display:flex;gap:6px;margin-bottom:10px">
        <button type="button" class="cal-type-btn active" data-cal-type="Gasto" onclick="Calendario._setType('Gasto')">💸 Gasto</button>
        <button type="button" class="cal-type-btn" data-cal-type="Ingreso" onclick="Calendario._setType('Ingreso')">💰 Ingreso</button>
      </div>
      <div class="form-group"><label>Importe (€)</label>
        <input type="number" id="calAmount" step="0.01" min="0.01" placeholder="0.00" style="font-size:18px;font-weight:700;width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group"><label>Descripción</label>
        <input type="text" id="calDesc" placeholder="¿Concepto?" maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group"><label>Categoría</label>
        <select id="calCategory" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          ${cats.map(c => `<option value="${esc(c)}" ${c === (frequent[0] || 'Comida') ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        ${frequent.length > 0 ? `<div class="cal-cat-chips"><span style="font-size:11px;color:var(--text-secondary)">Frecuentes:</span>${freqChips}</div>` : ''}
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
        Store.addTransaction({ date, amount, description: desc, type, category, paymentMethod: method, account });
        if (type !== 'Ingreso' && Store.isRoundUpEnabled()) {
          const diff = Presupuesto.getRoundUp(amount);
          if (diff > 0) Store.addRoundUp(diff);
        }
        App._closeModal();
        App._refreshAll();
        this.render();
        App.showToast(`✅ ${type} añadido para ${date.split('-').reverse().join('/')}`);
      }
    );
    setTimeout(() => document.getElementById('calAmount')?.focus(), 80);
  },

  _setType(type) {
    document.querySelectorAll('.cal-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.calType === type);
    });
  },

  _syncAccountFromMethod() {
    const method = document.getElementById('calMethod')?.value;
    const acc = document.getElementById('calAccount');
    if (!acc) return;
    if (method === 'Efectivo') acc.value = 'cash';
    else if (acc.value === 'cash') acc.value = 'checking';
  },

  resetView() {
    const [cy, cm] = App.getCurrentViewMonth().split('-').map(Number);
    this._viewYear = cy;
    this._viewMonth = cm - 1;
  },
};
