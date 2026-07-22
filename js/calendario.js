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

    const monthIncome = Store.sumCheckingInflow(transactions);
    const monthExpense = Store.sumCheckingOutflow(transactions);
    const monthTraspasos = transactions.filter(t => Store.isTraspaso(t) && (t.transferType || 'to_savings') === 'to_savings').reduce((s, t) => s + t.amount, 0);
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
          <div class="cal-sum-item"><span class="cal-sum-label income">Ingresos 💳</span><strong class="income">+${monthIncome.toFixed(0)} €</strong></div>
          <div class="cal-sum-item"><span class="cal-sum-label expense">Salidas 💳</span><strong class="expense">-${monthExpense.toFixed(0)} €</strong></div>
          ${monthTraspasos > 0 && monthTraspasos < monthExpense ? `<div class="cal-sum-item"><span class="cal-sum-label" style="color:#4F46E5">↳ Traspasos</span><strong style="color:#4F46E5">-${monthTraspasos.toFixed(0)} €</strong></div>` : ''}
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

      // Emoticonos del día (catálogo + personalizados)
      const dayEmojis = [...new Set(
        data.txs.filter(t => t.type !== 'Traspaso').map(t => Store.getTxDisplayEmoji(t))
      )].slice(0, 3);
      // Always show 🐷/🆘 for any Traspaso, regardless of whether it has t.emoji set
      const hasToSavings = data.txs.some(t => t.type === 'Traspaso' && t.transferType !== 'from_savings_emergency');
      const hasFromSavings = data.txs.some(t => t.type === 'Traspaso' && t.transferType === 'from_savings_emergency');

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
        ${hasToSavings && !isSavingsDay ? `<span class="cal-savings-icon" title="Traspaso a ahorro">🐷</span>` : ''}
        ${hasFromSavings ? `<span class="cal-savings-icon" title="Gasto de ahorro por imprevisto">🆘</span>` : ''}
        ${dayEmojis.length > 0 ? `<span style="font-size:10px;line-height:1;display:block">${dayEmojis.join('')}</span>` : ''}
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
      if (Store.isCheckingInflow(t)) map[t.date].income += t.amount;
      else if (t.type === 'Ingreso' && !Store.isAdjustment(t)) map[t.date].income += t.amount;
      if (Store.isCheckingOutflow(t)) map[t.date].expense += t.amount;
      else if (Store.isSpendableExpense(t)) map[t.date].expense += t.amount;
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
    const income = txs.filter(t => Store.isCheckingInflow(t)).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => Store.isCheckingOutflow(t)).reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

    const isArchived = App.isViewingArchived();
    const allGroups = Store.getTxGroups();
    const renderedGroups = new Set();

    const renderCalTxRow = (t) => {
      const isTrsp    = Store.isTraspaso(t);
      const isIncome  = t.type === 'Ingreso';
      const linkedDebts = Store.getDebtsByLinkedTx(t.id);
      const cls = isTrsp ? 'traspaso' : isIncome ? 'income' : 'expense';
      const displayIcon = Store.getTxDisplayEmoji(t);
      const pfx  = isIncome ? '+' : isTrsp ? '⇄ ' : '-';
      const debtBadge = typeof Deudas !== 'undefined' ? Deudas.debtBadgeHtml(t.id) : '';
      const group = !isTrsp && !isIncome ? Store.getCategoryGroup(t.category)
        : (!isTrsp && isIncome ? Store.getIncomeGroup(t.category) : null);
      const groupEmoji = group
        ? ` ${Store.getGroupDisplayEmoji(group, isIncome)}`
        : '';
      const trsLabel = isTrsp ? (t.transferType === 'from_savings_emergency' ? ' 🆘 Ahorro→Corriente' : ' 💳→🐷') : '';
      return `<div class="cal-tx-row" id="cal-tx-${t.id}">
        <span class="cal-tx-icon ${cls}">${displayIcon}</span>
        <div class="cal-tx-info">
          <div class="cal-tx-desc">${esc(t.description || t.category)}${debtBadge}${groupEmoji}</div>
          <div class="cal-tx-meta">${esc(t.category)}${t.paymentMethod && !isTrsp ? ' · ' + esc(t.paymentMethod) : ''}${trsLabel}</div>
        </div>
        <span class="cal-tx-amt ${cls}">${pfx}${t.amount.toFixed(2)}€</span>
        ${!isArchived ? `<div class="cal-tx-actions">
          ${!isTrsp && !Store.isAdjustment(t) ? `<button title="Agrupar ingreso/gasto" onclick="Calendario._openGroupModal('${t.id}','${dateStr}')">🔗</button>` : ''}
          ${Store.isDebtExpense(t) ? `<button title="${linkedDebts.length ? 'Editar deudas' : 'Asociar deuda'}" onclick="Deudas.openLinkToTx('${t.id}')">💸</button>` : ''}
          <button title="Editar" onclick="Calendario._editFromCalendar('${t.id}','${dateStr}')">✏️</button>
          <button title="Eliminar" onclick="Calendario._deleteFromCalendar('${t.id}','${dateStr}')">🗑️</button>
        </div>` : ''}
      </div>`;
    };

    const renderCalGroup = (groupId, group) => {
      // All members in any date (group may span days), but only show here since this day has at least one member
      const members = Store.getTransactions().filter(t => t.groupId === groupId);
      const expense  = members.filter(t => Store.isExpense(t)).reduce((s,t) => s + t.amount, 0);
      const income   = members.filter(t => t.type === 'Ingreso').reduce((s,t) => s + t.amount, 0);
      const net      = expense - income;
      return `<div class="cal-group-card">
        <div class="cal-group-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <span class="cal-tx-icon expense">🔗</span>
          <div class="cal-tx-info">
            <div class="cal-tx-desc">${esc(group.name)} <span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">grupo</span></div>
            <div class="cal-tx-meta">${members.length} movimientos · neto: <strong style="color:${net<=0?'var(--income)':'var(--expense)'}">${net>=0?'-':'+'}${Math.abs(net).toFixed(2)}€</strong></div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:12px;color:var(--expense)">-${expense.toFixed(2)}€</div>
            ${income>0?`<div style="font-size:12px;color:var(--income)">+${income.toFixed(2)}€</div>`:''}
            <div style="font-size:14px;font-weight:800;color:${net<=0?'var(--income)':'var(--expense)'}">= ${net>=0?'-':'+'}${Math.abs(net).toFixed(2)}€</div>
          </div>
          ${!isArchived ? `<div class="cal-tx-actions" onclick="event.stopPropagation()">
            <button title="Añadir al grupo" onclick="Calendario._addToExistingGroup('${groupId}','${dateStr}')">➕</button>
            <button title="Renombrar" onclick="Calendario._renameGroup('${groupId}','${dateStr}')">✏️</button>
            <button title="Disolver" onclick="Calendario._dissolveGroup('${groupId}','${dateStr}')">🗑️</button>
          </div>` : ''}
        </div>
        <div class="cal-group-members hidden">
          ${members.sort((a,b)=>a.date.localeCompare(b.date)).map(m => {
            const mIcon = Store.getTxDisplayEmoji(m);
            const mCls = Store.isTraspaso(m) ? 'traspaso' : m.type === 'Ingreso' ? 'income' : 'expense';
            const mPfx = m.type === 'Ingreso' ? '+' : Store.isTraspaso(m) ? '⇄ ' : '-';
            return `<div class="cal-tx-row">
              <span class="cal-tx-icon ${mCls}">${mIcon}</span>
              <div class="cal-tx-info">
                <div class="cal-tx-desc">${esc(m.description || m.category)}</div>
                <div class="cal-tx-meta">${m.date.split('-').reverse().join('/')} · ${esc(m.category)}</div>
              </div>
              <span class="cal-tx-amt ${mCls}">${mPfx}${m.amount.toFixed(2)}€</span>
              ${!isArchived ? `<div class="cal-tx-actions">
                <button title="Sacar del grupo" onclick="Calendario._removeFromGroup('${m.id}','${dateStr}')">✂️</button>
                <button title="Editar" onclick="Calendario._editFromCalendar('${m.id}','${dateStr}')">✏️</button>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    };

    const txHtml = txs.length === 0
      ? '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px">Sin movimientos este día</p>'
      : txs.sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'Ingreso' ? -1 : 1)).map(t => {
          if (t.groupId && allGroups[t.groupId]) {
            if (renderedGroups.has(t.groupId)) return '';
            renderedGroups.add(t.groupId);
            return renderCalGroup(t.groupId, allGroups[t.groupId]);
          }
          return renderCalTxRow(t);
        }).join('');

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
            <option value="cash"${t.account === 'cash' ? ' selected' : ''}>💵 Efectivo</option>
          </select>
        </div>
        <div class="form-group"><label>Emoticono <span style="font-size:10px;color:var(--text-secondary)">(opcional)</span></label>
          ${EmojiUtils.renderPicker('calEditEmoji', { value: t.emoji || '', compact: true })}
        </div>
        ${Store.isDebtExpense(t) ? Deudas.inlineFormHtml('calEdit', t.amount.toString(), t.description || '', null, Store.getDebtsByLinkedTx(id)) : ''}`,
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const amount   = parseFloat(document.getElementById('calEditAmount')?.value);
          const desc     = document.getElementById('calEditDesc')?.value.trim();
          const category = document.getElementById('calEditCategory')?.value;
          const method   = document.getElementById('calEditMethod')?.value;
          const account  = document.getElementById('calEditAccount')?.value;
          const emoji = typeof EmojiUtils !== 'undefined'
            ? EmojiUtils.readInput('calEditEmoji')
            : (document.getElementById('calEditEmoji')?.value.trim() || '');
          if (!amount || amount <= 0) { App.showToast('Importe inválido'); return; }
          const updateData = { amount, description: desc, category, paymentMethod: method, account, emoji };
          Store.updateTransaction(id, updateData);
          if (Store.isDebtExpense(t)) Deudas.saveInlineDebt('calEdit', id, t.date, desc, category);
          Calendario.render();
          if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
          if (document.getElementById('tab-deudas')?.classList.contains('active')) Deudas.render();
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
      <div id="calAccountGroup" class="form-group"><label>Cuenta</label>
        <select id="calAccount" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          <option value="checking">💳 Corriente</option>
          <option value="savings">🐷 Ahorro</option>
          <option value="cash">💵 Efectivo</option>
        </select>
      </div>
      <div id="calTransferTypeRow" style="display:none;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px">Tipo de traspaso:</div>
        <div style="display:flex;gap:6px">
          <button type="button" id="calTransferTo" style="flex:1;padding:8px;font-size:12px;border-radius:8px;border:none;background:linear-gradient(135deg,#4F46E5,#10B981);color:#fff;cursor:pointer"
            onclick="Calendario._setCalTransferType('to_savings')">💸→🐷 Corriente → Ahorro</button>
          <button type="button" id="calTransferFrom" style="flex:1;padding:8px;font-size:12px;border-radius:8px;border:1px solid var(--border);background:var(--card);cursor:pointer"
            onclick="Calendario._setCalTransferType('from_savings_emergency')">🆘 Ahorro → Corriente (imprevisto)</button>
        </div>
      </div>
      <div class="form-group">
        <label>Emoticono <span style="font-size:10px;color:var(--text-secondary)">(opcional)</span></label>
        ${EmojiUtils.renderPicker('calEmoji', { compact: true })}
      </div>
      <input type="hidden" id="calDate" value="${dateStr}">
      <input type="hidden" id="calTransferType" value="to_savings">
      ${Deudas.inlineFormHtml('cal')}`,
      '➕ Añadir', () => {
        const amount = parseFloat(document.getElementById('calAmount').value);
        const desc = document.getElementById('calDesc').value.trim();
        const category = document.getElementById('calCategory').value;
        const method = document.getElementById('calMethod').value;
        const account = document.getElementById('calAccount')?.value || 'checking';
        const type = document.querySelector('.cal-type-btn.active')?.dataset?.calType || 'Gasto';
        const date = document.getElementById('calDate').value;
        const emoji = typeof EmojiUtils !== 'undefined'
          ? EmojiUtils.readInput('calEmoji')
          : (document.getElementById('calEmoji')?.value.trim() || '');
        const transferType = document.getElementById('calTransferType')?.value || 'to_savings';
        if (!amount || amount <= 0 || !date) return;
        if (date !== dateStr) { App.showToast('⚠️ Fecha inválida'); return; }
        let saved;
        if (type === 'Traspaso') {
          const isEmergency = transferType === 'from_savings_emergency';
          const result = Store.createAccountTransfer({
            amount,
            date,
            description: desc || (isEmergency ? 'Gasto de ahorro (imprevisto)' : 'Traspaso a ahorro'),
            transferType,
            emoji: emoji || (isEmergency ? '🆘' : '🐷'),
            skipTransferLog: isEmergency,
          });
          if (result === -1) {
            App.showToast(isEmergency
              ? '❌ Saldo insuficiente en ahorro'
              : '❌ Saldo insuficiente en cuenta corriente');
            return;
          }
          saved = result;
        } else {
          const txData = { date, amount, description: desc, type, category, paymentMethod: method, account };
          if (emoji) txData.emoji = emoji;
          saved = Store.addTransaction(txData);
          if (type === 'Gasto') Deudas.saveInlineDebt('cal', saved?.id, date, desc, category);
          if (type === 'Ingreso') App.suggestSavings(amount);
        }
        App._refreshAll();
        if (document.getElementById('tab-deudas')?.classList.contains('active')) Deudas.render();
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
    const isTraspaso = type === 'Traspaso';
    // For Traspaso, hide category/method/account fields, show transfer type row
    const catGroup    = document.getElementById('calCategory')?.closest('.form-group');
    const methodGroup = document.getElementById('calMethod')?.closest('.form-group');
    const accountGroup = document.getElementById('calAccountGroup');
    const transferRow = document.getElementById('calTransferTypeRow');
    if (catGroup)    catGroup.style.display    = isTraspaso ? 'none' : '';
    if (methodGroup) methodGroup.style.display = isTraspaso ? 'none' : '';
    if (accountGroup) accountGroup.style.display = isTraspaso ? 'none' : '';
    if (transferRow) transferRow.style.display = isTraspaso ? '' : 'none';
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

  _setCalTransferType(ttype) {
    const hidden = document.getElementById('calTransferType');
    if (hidden) hidden.value = ttype;
    const btnTo = document.getElementById('calTransferTo');
    const btnFrom = document.getElementById('calTransferFrom');
    if (!btnTo || !btnFrom) return;
    if (ttype === 'to_savings') {
      btnTo.style.background = 'linear-gradient(135deg,#4F46E5,#10B981)';
      btnTo.style.color = '#fff';
      btnTo.style.border = 'none';
      btnFrom.style.background = 'var(--card)';
      btnFrom.style.color = '';
      btnFrom.style.border = '1px solid var(--border)';
      const descInput = document.getElementById('calDesc');
      if (descInput) descInput.value = 'Traspaso a ahorro';
    } else {
      btnFrom.style.background = 'linear-gradient(135deg,#EC4899,#EF4444)';
      btnFrom.style.color = '#fff';
      btnFrom.style.border = 'none';
      btnTo.style.background = 'var(--card)';
      btnTo.style.color = '';
      btnTo.style.border = '1px solid var(--border)';
      const descInput = document.getElementById('calDesc');
      if (descInput) descInput.value = 'Gasto de ahorro (imprevisto)';
    }
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

  _afterGroupChange(dateStr) {
    this.render();
    if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
    App._refreshAll?.();
    if (dateStr) setTimeout(() => this._showDay(dateStr), 100);
  },

  _openGroupModal(txId, dateStr) {
    if (typeof Registro !== 'undefined') {
      Registro._openGroupModal(txId, () => this._afterGroupChange(dateStr));
    }
  },

  _addToExistingGroup(groupId, dateStr) {
    if (typeof Registro !== 'undefined') {
      Registro._addToExistingGroup(groupId, () => this._afterGroupChange(dateStr));
    }
  },

  _renameGroup(groupId, dateStr) {
    if (typeof Registro !== 'undefined') {
      Registro._renameGroup(groupId, () => this._afterGroupChange(dateStr));
    }
  },

  _dissolveGroup(groupId, dateStr) {
    if (typeof Registro !== 'undefined') {
      Registro._dissolveGroup(groupId, () => this._afterGroupChange(dateStr));
    }
  },

  _removeFromGroup(txId, dateStr) {
    Store.setTxGroup(txId, null);
    this._afterGroupChange(dateStr);
  },
};
