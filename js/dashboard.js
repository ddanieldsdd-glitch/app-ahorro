const Dashboard = {
  _dayNames: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],

  render() {
    const budget = Presupuesto._calc();
    const transactions = App.getCurrentTransactions().filter(t => !Store.isAdjustment(t));
    const income = transactions.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    const goals = Store.getSavingGoals();
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0) + (Store.getTotalRoundUpSavings() || 0);
    const savingsBalance = Store.getSavingsBalance();
    const checkingBalance = Store.getCheckingBalance();
    const totalWealth = checkingBalance !== null && checkingBalance !== undefined ? checkingBalance + savingsBalance : savingsBalance;
    const weeklyPct = budget.totalWeekly > 0 ? Math.min(100, (budget.actualExpense / budget.totalWeekly) * 100) : 0;
    const dailyRec = budget.daysLeft > 0 ? Math.max(0, budget.remaining / budget.daysLeft) : 0;

    const foodBudget = Store.getFoodBudget();
    const foodWeekly = foodBudget / 4.33;
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const imprevistosBudget = Store.getImprevistosBudget();
    const imprevistosWeekly = imprevistosBudget / 4.33;
    const imprevistosMonthlySpent = Store.getImprevistosMonthlySpent();
    const imprevistosRemaining = Math.max(0, imprevistosBudget - imprevistosMonthlySpent);
    const imprevistosSavings = Store.getImprevistosSavings();
    const plannedExpensesWeekly = Store.getPlannedExpensesWeeklyNeed();
    const plannedExpensesReserved = Store.getPlannedExpensesReserved();
    const totalDeductions = foodWeekly + recommendedWeeklySaving + plannedExpensesWeekly + imprevistosWeekly;
    const adjustedRemaining = budget.remaining;
    const adjustedDaily = budget.daysLeft > 0 ? Math.max(0, adjustedRemaining / budget.daysLeft) : 0;

    const limits = Store.getCategoryLimits();
    const weekTx = Presupuesto._getWeekTransactions();
    const weekExpenses = weekTx.filter(t => t.type !== 'Ingreso');
    const catsWithLimits = Object.keys(limits).filter(c => limits[c] > 0);
    const plannedExpenses = Store.getPlannedExpenses();
    const debts = Store.getDebts();
    const activeDebts = debts.filter(d => !d.isPaid);

    const _now = new Date();
    const _dow = _now.getDay();
    const _diff = _dow === 0 ? -6 : 1 - _dow;
    const _thisMon = new Date(_now);
    _thisMon.setDate(_now.getDate() + _diff);
    _thisMon.setHours(0, 0, 0, 0);
    const thisMondayStr = _thisMon.toISOString().split('T')[0];
    const savingsDone = Store.getLastSavingsWeek() === thisMondayStr;
    const peReserveDone = Store.getLastPEReserveWeek() === thisMondayStr;

    document.getElementById('tab-dashboard').innerHTML = `
      <div class="dh-hero">
        <div class="dh-hero-inner">
          <div class="dh-hero-top">
            <div style="display:flex;align-items:center;gap:8px">
              <span>${this._dayNames[new Date().getDay()]}, ${new Date().getDate()}</span>
              <select id="dhMonthQuick" style="background:rgba(255,255,255,0.2);border:none;border-radius:6px;padding:4px 8px;color:white;font-weight:600;font-size:12px;cursor:pointer">
                ${document.getElementById('monthSelector').innerHTML}
              </select>
            </div>
            <div style="font-weight:700">${balance >= 0 ? '+' : ''}${balance.toFixed(0)} €</div>
          </div>
          <div class="dh-hero-main">
            <div class="dh-hero-label">HOY PUEDES GASTAR</div>
            <div class="dh-hero-value">${dailyRec.toFixed(2)}<span class="dh-hero-value-unit">€</span></div>
            <div class="dh-hero-sub">${budget.remaining.toFixed(2)} € para ${budget.daysLeft} días · 🎯 <strong>${recommendedWeeklySaving.toFixed(2)} €/sem</strong> metas · ⚠️ <strong>${imprevistosWeekly.toFixed(2)} €/sem</strong> imprev.</div>
          </div>
          <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;justify-content:center">
            <div style="min-width:60px;flex:1;text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:4px 2px">
              <div style="font-size:8px;opacity:0.8">🍽️ Comida</div>
              <div style="font-size:13px;font-weight:800">${foodWeekly.toFixed(1)}€</div>
            </div>
            <div style="min-width:60px;flex:1;text-align:center;background:rgba(255,255,255,0.12);border-radius:8px;padding:4px 2px">
              <div style="font-size:8px;opacity:0.8">🎯 Ahorro</div>
              <div style="font-size:13px;font-weight:800">${recommendedWeeklySaving.toFixed(1)}€</div>
            </div>
            ${plannedExpensesWeekly > 0 ? `<div style="min-width:60px;flex:1;text-align:center;background:rgba(255,255,255,0.1);border-radius:8px;padding:4px 2px">
              <div style="font-size:8px;opacity:0.8">📋 G.Planif.</div>
              <div style="font-size:13px;font-weight:800">${plannedExpensesWeekly.toFixed(1)}€</div>
            </div>` : ''}
            ${imprevistosWeekly > 0 ? `<div style="min-width:60px;flex:1;text-align:center;background:rgba(255,255,255,0.1);border-radius:8px;padding:4px 2px">
              <div style="font-size:8px;opacity:0.8">⚠️ Imprev.</div>
              <div style="font-size:13px;font-weight:800">${imprevistosWeekly.toFixed(1)}€</div>
            </div>` : ''}
            <div style="min-width:60px;flex:1;text-align:center;background:rgba(255,255,255,0.15);border-radius:8px;padding:4px 2px">
              <div style="font-size:8px;opacity:0.8">💸 Disponible</div>
              <div style="font-size:13px;font-weight:800;color:${adjustedRemaining > 0 ? '#6EE7B7' : '#FCA5A5'}">${Math.max(0, adjustedRemaining).toFixed(1)}€</div>
            </div>
          ${checkingBalance !== null ? `<div style="text-align:center;margin-top:6px;font-size:11px;opacity:0.8">💳 Cuenta: <strong>${checkingBalance.toFixed(0)} €</strong> · 🔒 Base: <strong>${Store.getCheckingBaseBalance().toFixed(0)} €</strong> · 💸 Libre: <strong style="color:#6EE7B7">${Math.max(0, checkingBalance - Store.getCheckingBaseBalance()).toFixed(0)} €</strong></div>` : ''}
          </div>
          <div class="dh-hero-stats">
            <div class="dh-stat"><span class="dh-stat-value income">${income.toFixed(0)}</span><span class="dh-stat-label">Ingresos</span></div>
            <div class="dh-stat"><span class="dh-stat-value expense">${expense.toFixed(0)}</span><span class="dh-stat-label">Gastos</span></div>
            <div class="dh-stat"><span class="dh-stat-value" style="color:#C7D2FE">${balance.toFixed(0)}</span><span class="dh-stat-label">Balance</span></div>
            <div class="dh-stat"><span class="dh-stat-value" style="color:#6EE7B7">${savingsBalance.toFixed(0)}</span><span class="dh-stat-label">Ahorro real</span></div>
          </div>
        </div>
      </div>

      ${recommendedWeeklySaving > 0 || imprevistosSavings > 0 ? `
      <div style="text-align:center;margin-bottom:12px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          ${recommendedWeeklySaving > 0 && !savingsDone ? `
          <div>
            <button class="btn btn-primary" style="padding:12px 24px;font-size:15px;font-weight:700;border-radius:12px;box-shadow:0 4px 12px rgba(79,70,229,0.3)" onclick="Dashboard._ingresarAhorro()">
              ✅ Ya he ingresado el ahorro (${recommendedWeeklySaving.toFixed(2)} €)
            </button>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Transfiere ${recommendedWeeklySaving.toFixed(2)} € a la cuenta de ahorro</div>
          </div>` : recommendedWeeklySaving > 0 && savingsDone ? `
          <div>
            <div style="padding:12px 24px;font-size:15px;font-weight:700;border-radius:12px;background:var(--income-bg);color:var(--income);border:2px solid var(--income);display:inline-block">
              ✅ Ahorro completado esta semana (${recommendedWeeklySaving.toFixed(2)} €)
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Vuelve el lunes que viene para el siguiente ahorro</div>
          </div>` : ''}
          ${imprevistosSavings > 0 ? `
          <div>
            <button class="btn" style="padding:12px 24px;font-size:15px;font-weight:700;border-radius:12px;background:linear-gradient(135deg,#EC4899,#8B5CF6);color:#fff;border:none;box-shadow:0 4px 12px rgba(236,72,153,0.3)" onclick="Dashboard._transferirImprevistosACuenta()">
              🐷 Imprevistos (${imprevistosSavings.toFixed(2)} €) →
            </button>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Pasa ahorro de imprevistos a tu base de cuenta</div>
          </div>` : ''}
          ${plannedExpensesWeekly > 0 && !peReserveDone ? `
          <div>
            <button class="btn btn-primary" style="padding:12px 24px;font-size:15px;font-weight:700;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#4F46E5);box-shadow:0 4px 12px rgba(139,92,246,0.3)" onclick="Dashboard._reservarGastosPlanificados()">
              📋 Apartar gastos planif. (${plannedExpensesWeekly.toFixed(2)} €)
            </button>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Reserva semanal para gastos planificados · ${plannedExpensesReserved.toFixed(2)} € reservados</div>
          </div>` : plannedExpensesWeekly > 0 && peReserveDone ? `
          <div>
            <div style="padding:12px 24px;font-size:15px;font-weight:700;border-radius:12px;background:var(--income-bg);color:var(--income);border:2px solid var(--income);display:inline-block">
              ✅ Gastos planif. reservados (${plannedExpensesWeekly.toFixed(2)} €)
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${plannedExpensesReserved.toFixed(2)} € acumulados · Vuelve el lunes para la siguiente reserva</div>
          </div>` : ''}
        </div>
      </div>` : ''}

      <div class="dh-section">
        <div class="dh-section-header">
          <span class="dh-section-title">📅 Presupuesto semanal</span>
          <span class="dh-section-badge">${budget.daysLeft} días</span>
        </div>
        <div class="dh-budget-row">
          <div class="dh-ring-wrap">
            ${ringSVG(weeklyPct, 120, 12, weeklyPct >= 100 ? '#EF4444' : weeklyPct >= 80 ? '#F97316' : '#4F46E5')}
            <div class="dh-ring-center">
              <div class="dh-ring-pct">${weeklyPct.toFixed(0)}%</div>
              <div class="dh-ring-label">gastado</div>
            </div>
          </div>
          <div class="dh-budget-info">
            <div class="dh-budget-line"><span>Presupuesto</span><span class="dh-budget-val">${budget.totalWeekly.toFixed(2)} €</span></div>
            <div class="dh-budget-line"><span>Gastado</span><span class="dh-budget-val expense">-${budget.actualExpense.toFixed(2)} €</span></div>
            <div class="dh-budget-line dh-budget-line-total"><span>Te quedan</span><span class="dh-budget-val" style="color:${budget.remaining >= 0 ? 'var(--income)' : 'var(--expense)'}">${budget.remaining.toFixed(2)} €</span></div>
            <div class="dh-budget-line"><span>Por día</span><span class="dh-budget-val" style="color:var(--primary);font-weight:800">${dailyRec.toFixed(2)} €</span></div>
          </div>
        </div>
        <div class="dh-alloc">
          <div class="dh-alloc-item"><span>🍽️ Comida</span><span class="dh-alloc-val">${foodWeekly.toFixed(2)} €/sem</span></div>
          <div class="dh-alloc-item"><span>🎯 Ahorro</span><span class="dh-alloc-val">${recommendedWeeklySaving.toFixed(2)} €/sem</span></div>
          <div class="dh-alloc-item dh-alloc-item-total"><span>💰 Disponible tras ahorro</span><span class="dh-alloc-val" style="color:${adjustedDaily > 0 ? 'var(--income)' : 'var(--expense)'}">${Math.max(0, adjustedRemaining).toFixed(2)} €</span></div>
        </div>
        ${catsWithLimits.length > 0 ? `
        <div style="margin-top:12px">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:6px">🏷️ Por categoría esta semana</div>
          ${catsWithLimits.map(cat => {
            const limit = limits[cat];
            const spent = weekExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const remain = limit - spent;
            const level = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : pct >= 50 ? 'caution' : 'good';
            const barColor = { good: 'var(--income)', caution: '#F59E0B', warning: '#F97316', danger: 'var(--expense)' }[level];
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="min-width:70px;font-size:12px;font-weight:600">${cat}</span>
              <div style="flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width .3s"></div>
              </div>
              <span style="min-width:70px;text-align:right;font-size:11px;font-weight:600;color:${remain >= 0 ? 'var(--text-secondary)' : 'var(--expense)'}">${remain >= 0 ? `${remain.toFixed(0)}€` : `${Math.abs(remain).toFixed(0)}€ excedido`}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
        ${budget.daysLeft > 0 && dailyRec > 0 ? `
        <div class="dh-days-row">
          ${Array.from({length: Math.min(7, budget.daysLeft)}, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() + i);
            return `<div class="dh-day ${i === 0 ? 'dh-day-today' : ''}">
              <span class="dh-day-name">${i === 0 ? 'HOY' : this._dayNames[d.getDay()].toUpperCase()}</span>
              <span class="dh-day-val">${dailyRec.toFixed(1)}€</span>
            </div>`;
          }).join('')}
        </div>` : ''}
        ${budget.remaining <= 0 ? '<div class="dh-alert-red">🔴 Has superado el presupuesto semanal</div>' : ''}
      </div>

      ${goals.length > 0 ? `
      <div class="dh-section">
        <div class="dh-section-header">
          <span class="dh-section-title">🎯 Metas de ahorro</span>
          <span class="dh-section-badge">${totalSaved.toFixed(0)} €</span>
        </div>
        ${recommendedWeeklySaving > 0 ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Necesitas <strong style="color:var(--primary)">${recommendedWeeklySaving.toFixed(2)} €/sem</strong> para cumplir tus metas${budget.remaining >= recommendedWeeklySaving ? ' · ✅ Tienes presupuesto suficiente' : budget.remaining > 0 ? ` · 🟡 Te faltan ${(recommendedWeeklySaving - budget.remaining).toFixed(2)}€/sem` : ' · 🔴 Superaste tu presupuesto'}</div>` : ''}
        ${goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
          const remaining = g.targetAmount - g.currentAmount;
          let weeklyNeed = 0;
          if (remaining > 0 && g.targetDate) {
            const weeksLeft = Math.max(1, (new Date(g.targetDate + 'T23:59:59') - new Date()) / (7 * 86400000));
            weeklyNeed = remaining / weeksLeft;
          }
          return `<div class="dh-goal">
            <div class="dh-goal-hdr">            <span class="dh-goal-name">${esc(g.name)}</span><span class="dh-goal-pct">${pct.toFixed(0)}%</span></div>
            <div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--income)' : 'linear-gradient(90deg,#4F46E5,#10B981)'};border-radius:5px"></div></div>
            <div class="dh-goal-ftr"><span>${g.currentAmount.toFixed(0)} € / ${g.targetAmount.toFixed(0)} €</span>${g.currentAmount >= g.targetAmount ? '<span>✅</span>' : weeklyNeed > 0 ? `<span>${weeklyNeed.toFixed(1)} €/sem</span>` : remaining > 0 ? `<span style="color:var(--primary)">${(remaining / 52).toFixed(1)} €/sem*</span>` : ''}</div>
          </div>`;
        }).join('')}
      </div>` : `
      <div class="dh-section" style="text-align:center;padding:24px">
        <div style="font-size:32px;margin-bottom:8px">🎯</div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">Crea una meta de ahorro</div>
        <div style="font-size:12px;color:var(--text-secondary);margin:4px 0 12px">Define un objetivo y empieza a ahorrar</div>
        <button class="btn btn-primary btn-sm" onclick="App._switchTab('presupuesto')">Ir a Ahorro</button>
      </div>`}

      ${plannedExpenses.length > 0 ? `
      <div class="dh-section">
        <div class="dh-section-header">
          <span class="dh-section-title">📋 Gastos planificados</span>
          <span class="dh-section-badge">${plannedExpensesReserved.toFixed(0)} € reservados</span>
        </div>
        ${plannedExpenses.map(p => {
          const now = new Date();
          const tgt = new Date(p.targetDate + 'T23:59:59');
          const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
          const weeklyNeed = (p.amount - (p.savedSoFar || 0)) / weeksLeft;
          const fits = weeklyNeed <= (budget.totalWeekly - (Store.getFoodBudget() / 4.33));
          const pct = p.amount > 0 ? Math.min(100, ((p.savedSoFar || 0) / p.amount) * 100) : 0;
          return `<div class="dh-goal">
            <div class="dh-goal-hdr">
              <span class="dh-goal-name">${esc(p.name)}</span>
              <span style="font-size:12px;color:var(--primary);font-weight:600">${weeklyNeed.toFixed(1)} €/sem</span>
              <span style="font-size:11px">${fits ? '✅' : '🔴'}</span>
            </div>
            <div class="progress-bar" style="height:4px;margin:3px 0"><div class="progress-fill" style="width:${pct}%;background:var(--primary);border-radius:2px"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-secondary)">
              <span>${(p.savedSoFar || 0).toFixed(1)}€ / ${p.amount.toFixed(0)}€</span>
              <span>${Math.ceil(weeksLeft)} sem</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${imprevistosBudget > 0 ? `
      <div class="dh-section">
        <div class="dh-section-header">
          <span class="dh-section-title">⚠️ Reserva imprevistos</span>
          <span class="dh-section-badge">${imprevistosBudget.toFixed(0)} €/mes</span>
        </div>
        <div style="display:flex;gap:12px;font-size:12px;margin-bottom:6px;flex-wrap:wrap">
          <span>Gastado: <strong>${Store.getImprevistosMonthlySpent().toFixed(1)} €</strong></span>
          <span>Disponible: <strong style="color:${imprevistosRemaining > 0 ? 'var(--income)' : 'var(--expense)'}">${imprevistosRemaining.toFixed(1)} €</strong></span>
        </div>
        <div class="progress-bar" style="height:6px"><div class="progress-fill" style="width:${Math.min(100, (Store.getImprevistosMonthlySpent() / imprevistosBudget) * 100)}%;background:#EC4899;border-radius:3px"></div></div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${imprevistosRemaining > 0 ? '✅ Reserva disponible para imprevistos' : '🔴 Reserva agotada este mes'}</div>
        ${imprevistosSavings > 0 ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;display:flex;justify-content:space-between;align-items:center">
          <span>🐷 Ahorro acumulado: <strong style="color:var(--primary)">${imprevistosSavings.toFixed(2)} €</strong></span>
          <button class="btn btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="App._switchTab('presupuesto')">💰 Gestionar</button>
        </div>` : ''}
      </div>` : ''}

      ${activeDebts.length > 0 ? `
      <div class="dh-section">
        <div class="dh-section-header">
          <span class="dh-section-title">📋 Deudas a cobrar</span>
          <span class="dh-section-badge">${activeDebts.length}</span>
        </div>
        ${activeDebts.slice(0, 5).map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px">
          <span>👤 ${esc(d.person)}${d.description ? ` · ${esc(d.description)}` : ''}</span>
          <span style="font-weight:700;color:var(--income)">${d.amount.toFixed(2)} €</span>
        </div>`).join('')}
        ${activeDebts.length > 5 ? `<div style="font-size:11px;color:var(--text-secondary);text-align:center;padding:4px">... y ${activeDebts.length - 5} más</div>` : ''}
        <div style="margin-top:6px;text-align:center">
          <button class="btn btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="App._switchTab('presupuesto')">💰 Gestionar deudas</button>
        </div>
      </div>` : ''}
      ${this._renderUpcomingPayments()}
    `;

    const sel = document.getElementById('dhMonthQuick');
    if (sel) {
      sel.onchange = () => {
        document.getElementById('monthSelector').value = sel.value;
        document.getElementById('monthSelector').onchange();
      };
    }
  },

  _renderUpcomingPayments() {
    const recurring = Store.getRecurringTransactions().filter(r => r.active);
    const planned = Store.getPlannedExpenses();
    if (recurring.length === 0 && planned.length === 0) return '';

    const today = new Date();
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const in7Str = in7.toISOString().split('T')[0];

    const upcoming = [];

    // Recurring: check if any falls in the next 7 days
    for (const r of recurring) {
      const next = r.nextDate;
      if (next && next >= todayStr && next <= in7Str) {
        upcoming.push({ date: next, label: r.name || r.category, amount: r.amount, type: r.type, icon: '🔁' });
      }
    }

    // Planned expenses due in 7 days
    for (const p of planned) {
      if (p.targetDate && p.targetDate >= todayStr && p.targetDate <= in7Str) {
        const remaining = p.amount - (p.savedSoFar || 0);
        if (remaining > 0) upcoming.push({ date: p.targetDate, label: p.name, amount: p.amount, type: 'Gasto', icon: '📋' });
      }
    }

    if (upcoming.length === 0) return '';
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    return `<div class="card" style="border-left:3px solid #F59E0B">
      <div class="card-header">
        <span class="card-title">📅 Próximos pagos (7 días)</span>
        <span style="font-size:11px;color:var(--text-secondary)">${upcoming.length}</span>
      </div>
      ${upcoming.map(u => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:14px">${u.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.label)}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${u.date.split('-').reverse().join('/')}</div>
          </div>
          <strong class="${u.type === 'Ingreso' ? 'income' : 'expense'}" style="font-size:13px;white-space:nowrap">${u.type === 'Ingreso' ? '+' : '-'}${u.amount.toFixed(2)} €</strong>
        </div>`).join('')}
    </div>`;
  },

  _getMondayStr(d) {
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const m = new Date(d);
    m.setDate(d.getDate() + diff);
    m.setHours(0, 0, 0, 0);
    return m.toISOString().split('T')[0];
  },

  _ingresarAhorro() {
    const result = Store.distributeWeeklySavings();
    if (result === -1) {
      App.showCustom('Saldo insuficiente', '<p style="font-size:14px">No tienes suficiente saldo en la cuenta corriente para transferir el ahorro semanal.</p>', 'Cerrar', () => App._closeModal());
    } else if (result > 0) {
      Store.setLastSavingsWeek(this._getMondayStr(new Date()));
      App.showCustom('✅ Ahorro registrado', `<p style="font-size:14px">Has transferido <strong>${result.toFixed(2)} €</strong> a la cuenta de ahorro y se ha distribuido entre tus metas.</p><p style="font-size:12px;color:var(--text-secondary);margin-top:6px">✅ Queda marcado hasta el lunes que viene.</p>`, 'Perfecto', () => { App._closeModal(); this.render(); });
    }
  },

  _reservarGastosPlanificados() {
    const result = Store.reservePlannedExpensesWeekly();
    if (result === -1) {
      App.showCustom('Saldo insuficiente', '<p style="font-size:14px">No tienes suficiente saldo en la cuenta corriente para reservar los gastos planificados.</p>', 'Cerrar', () => App._closeModal());
    } else if (result > 0) {
      Store.setLastPEReserveWeek(this._getMondayStr(new Date()));
      App.showCustom('📋 Reserva realizada', `<p style="font-size:14px">Has apartado <strong>${result.toFixed(2)} €</strong> para tus gastos planificados. Este dinero está reservado hasta la fecha de cada gasto.</p>`, 'Perfecto', () => { App._closeModal(); this.render(); });
    }
  },

  _transferirImprevistosACuenta() {
    const available = Store.getImprevistosSavings();
    if (available <= 0) return;
    const checkingBase = Store.getCheckingBaseBalance();
    App.showCustom('🐷 Transferir ahorro de imprevistos',
      `<p style="font-size:14px">Tienes <strong>${available.toFixed(2)} €</strong> acumulados de imprevistos. Indica cuánto quieres pasar a la <strong>base de tu cuenta corriente</strong> (actual: ${checkingBase.toFixed(2)} €):</p>
      <div style="margin:10px 0;padding:12px;background:var(--bg);border-radius:8px">
        <label style="font-size:13px;font-weight:600">Transferir a base de cuenta corriente:</label>
        <input type="number" id="transferImpToBase" value="${available.toFixed(0)}" step="1" min="0.01" max="${available}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-top:6px;font-size:18px;font-weight:700">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-top:4px">
          <span>Disponible: ${available.toFixed(2)} €</span>
          <span id="impAfterTransfer">Dejarás en imprevistos: ${(0).toFixed(2)} €</span>
        </div>
      </div>`,
      '✅ Transferir', () => {
        const val = parseFloat(document.getElementById('transferImpToBase').value);
        if (!val || val <= 0) return;
        const result = Store.transferImprevistosToCheckingBase(val);
        if (result > 0) {
          App._closeModal();
          this.render();
        }
      }
    );
    setTimeout(() => {
      const inp = document.getElementById('transferImpToBase');
      if (inp) {
        inp.addEventListener('input', () => {
          const v = parseFloat(inp.value) || 0;
          const remaining = Math.max(0, available - v);
          document.getElementById('impAfterTransfer').textContent = `Dejarás en imprevistos: ${remaining.toFixed(2)} €`;
        });
      }
    }, 50);
  },
};
