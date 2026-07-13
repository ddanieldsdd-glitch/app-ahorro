const Presupuesto = {
  render() {
    this._ensureDefaultLimits();
    const budget = this._calc();
    const limits = Store.getCategoryLimits();
    const categories = Store.getCategories();
    const weekTx = this._getWeekTransactions();
    const weekExpenses = weekTx.filter(t => t.type !== 'Ingreso');
    const allTx = Store.getTransactions().filter(t => !Store.isAdjustment(t));
    const allExpenses = allTx.filter(t => t.type !== 'Ingreso');
    const allIncome = allTx.filter(t => t.type === 'Ingreso');
    const goals = Store.getSavingGoals();
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const totalSaved = goals.reduce((s,g) => s+g.currentAmount, 0) + (Store.getTotalRoundUpSavings() || 0);
    const foodBudget = Store.getFoodBudget();
    const foodSpent = this._getMonthFoodSpending();
    const foodRemaining = Math.max(0, foodBudget - foodSpent);
    const monthDays = this._getMonthDaysLeft();
    const foodDaily = monthDays > 0 ? foodRemaining / monthDays : 0;
    const foodPct = foodBudget > 0 ? Math.min(100, (foodSpent / foodBudget) * 100) : 0;
    const el = document.getElementById('tab-presupuesto');
    const foodWeekly = foodBudget / 4.33;
    const imprevistosBudget = Store.getImprevistosBudget();
    const imprevistosWeekly = imprevistosBudget / 4.33;
    const imprevistosSpent = Store.getImprevistosMonthlySpent();
    const imprevistosRemaining = Math.max(0, imprevistosBudget - imprevistosSpent);
    const imprevistosSavings = Store.getImprevistosSavings();
    const plannedExpensesWeekly = Store.getPlannedExpensesWeeklyNeed();
    const totalDeductions = foodWeekly + recommendedWeeklySaving + plannedExpensesWeekly + imprevistosWeekly;
    const available = budget.totalWeekly - totalDeductions;
    const foodPctIncome = budget.totalWeekly > 0 ? (foodWeekly / budget.totalWeekly) * 100 : 0;
    const savePctIncome = budget.totalWeekly > 0 ? (recommendedWeeklySaving / budget.totalWeekly) * 100 : 0;
    const pePctIncome = budget.totalWeekly > 0 ? (plannedExpensesWeekly / budget.totalWeekly) * 100 : 0;
    const impPctIncome = budget.totalWeekly > 0 ? (imprevistosWeekly / budget.totalWeekly) * 100 : 0;
    const availPctIncome = budget.totalWeekly > 0 ? (available / budget.totalWeekly) * 100 : 0;
    const planAdvice = [];
    if (available <= 0) planAdvice.push(`🔴 Tus gastos planificados superan tus ingresos. Revisa metas, imprevistos o gastos planificados.`);
    else if (available < recommendedWeeklySaving) planAdvice.push(`💪 El ${savePctIncome.toFixed(0)}% de tus ingresos va a ahorro. Te quedan ${available.toFixed(2)}€/sem para gastar.`);
    else planAdvice.push(`✅ Plan equilibrado: ${foodPctIncome.toFixed(0)}% comida · ${savePctIncome.toFixed(0)}% ahorro · ${availPctIncome.toFixed(0)}% gastos.`);
    if (available > 0) planAdvice.push(`💡 Prioriza gastar de tus ingresos semanales antes de usar el saldo de tu cuenta. La base guardada no se toca.`);
    if (recommendedWeeklySaving > 0 && available >= recommendedWeeklySaving) planAdvice.push(`💰 Cumples tu objetivo de ahorro semanal (${recommendedWeeklySaving.toFixed(2)}€/sem) con margen.`);
    else if (recommendedWeeklySaving > 0 && available > 0) planAdvice.push(`🎯 Te quedan ${available.toFixed(2)}€/sem para gastar. Prioriza tu meta de ahorro antes de gastar.`);

    el.innerHTML = `
      <div class="sa-card sa-card-plan">
        <div class="card-header">
          <span class="card-title" style="font-size:17px">🧠 Tu plan financiero inteligente</span>
        </div>
        <div class="sa-plan-stack" style="margin-bottom:12px">
          <div class="sa-plan-bar">
            <div class="sa-plan-bar-seg" style="width:${foodPctIncome}%;background:#F59E0B" title="🍽️ Comida ${foodWeekly.toFixed(2)}€/sem"></div>
            <div class="sa-plan-bar-seg" style="width:${savePctIncome}%;background:#4F46E5" title="🎯 Ahorro ${recommendedWeeklySaving.toFixed(2)}€/sem"></div>
            <div class="sa-plan-bar-seg" style="width:${pePctIncome}%;background:#8B5CF6" title="📋 Gastos planif. ${plannedExpensesWeekly.toFixed(2)}€/sem"></div>
            <div class="sa-plan-bar-seg" style="width:${impPctIncome}%;background:#EC4899" title="⚠️ Imprevistos ${imprevistosWeekly.toFixed(2)}€/sem"></div>
            <div class="sa-plan-bar-seg" style="width:${availPctIncome}%;background:#10B981" title="💸 Gastar ${Math.max(0,available).toFixed(2)}€/sem"></div>
          </div>
          <div class="sa-plan-bar-labels">
            <span>🍽️ ${foodWeekly.toFixed(1)}€</span>
            <span>🎯 ${recommendedWeeklySaving.toFixed(1)}€</span>
            ${plannedExpensesWeekly > 0 ? `<span>📋 ${plannedExpensesWeekly.toFixed(1)}€</span>` : ''}
            ${imprevistosWeekly > 0 ? `<span>⚠️ ${imprevistosWeekly.toFixed(1)}€</span>` : ''}
            <span>💸 ${Math.max(0,available).toFixed(1)}€</span>
          </div>
        </div>
        <div class="sa-plan-items">
          <div class="sa-plan-row"><span>💰 Ingreso semanal total</span><strong>${budget.totalWeekly.toFixed(2)} €</strong></div>
          <div class="sa-plan-row sa-plan-row-adjust"><span>🍽️ Comida <span class="sa-plan-badge">obligatorio</span></span>
            <div><input type="number" id="planFoodBudget" value="${foodBudget}" step="5" class="sa-plan-input" onchange="Presupuesto._savePlanFood()"> €/mes <span class="sa-plan-sub">${foodWeekly.toFixed(2)} €/sem</span></div>
          </div>
          <div class="sa-plan-row"><span>🎯 Ahorro (según metas)</span><strong style="color:var(--primary)">${recommendedWeeklySaving.toFixed(2)} €/sem</strong></div>
          ${plannedExpensesWeekly > 0 ? `<div class="sa-plan-row"><span>📋 Gastos planificados</span><strong style="color:#8B5CF6">${plannedExpensesWeekly.toFixed(2)} €/sem</strong></div>` : ''}
          ${imprevistosWeekly > 0 ? `<div class="sa-plan-row"><span>⚠️ Reserva imprevistos</span><strong style="color:#EC4899">${imprevistosWeekly.toFixed(2)} €/sem</strong></div>` : ''}
          <div class="sa-plan-row sa-plan-row-total"><span>💸 Disponible para gastar</span><strong style="color:${available > 0 ? 'var(--income)' : 'var(--expense)'};font-size:18px">${Math.max(0,available).toFixed(2)} €/sem</strong></div>
          ${available > 0 ? `<div class="sa-plan-row"><span>📅 Por día</span><strong style="color:var(--primary)">${(available / 7).toFixed(2)} €/día</strong></div>` : ''}
        </div>
        <div class="sa-plan-advice">${planAdvice.map(t => `<div>${t}</div>`).join('')}</div>
      </div>

      <div class="sa-card sa-card-saving">
        <div class="card-header">
          <span class="card-title">🎯 Metas de ahorro</span>
          <button class="btn btn-primary btn-sm" onclick="Presupuesto._addGoal()">+ Nueva</button>
        </div>
        ${recommendedWeeklySaving > 0 ? `
        <div class="sa-saving-weekly">
          <div class="sa-saving-weekly-label">Ahorro semanal recomendado</div>
          <div class="sa-saving-weekly-val">${recommendedWeeklySaving.toFixed(2)} <span class="sa-saving-weekly-unit">€/sem</span></div>
          <div style="font-size:12px;color:var(--text-secondary)">Para alcanzar tus metas a tiempo</div>
        </div>` : ''}
        <div id="goalList">
          ${goals.length === 0 ? '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:12px">Crea una meta para empezar a ahorrar</p>' : goals.map((g, i) => {
            const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
            const remaining = g.targetAmount - g.currentAmount;
            const now = new Date();
            let weeklyNeed = 0, monthsLeftStr = '';
            if (remaining > 0) {
              if (g.targetDate) {
                const tgt = new Date(g.targetDate + 'T23:59:59');
                const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
                weeklyNeed = remaining / weeksLeft;
                const months = Math.max(0, Math.round((tgt - now) / (30.44 * 86400000)));
                monthsLeftStr = months > 0 ? `${months} meses` : `${Math.round(weeksLeft)} sem`;
              } else {
                weeklyNeed = remaining / 52;
              }
            }
            const dateStr = g.targetDate ? new Date(g.targetDate + 'T00:00:00').toLocaleDateString('es') : '';
            let timeInfo;
            if (remaining <= 0) timeInfo = '<div class="sa-goal-weekly" style="color:var(--income);background:var(--income-bg);display:block">🎉 ¡Meta alcanzada!</div>';
            else if (g.targetDate && weeklyNeed > 0) timeInfo = `<div class="sa-goal-weekly" style="display:flex;justify-content:space-between;background:var(--primary-light);border:1px solid rgba(79,70,229,0.15)">
              <span>📅 Quedan <strong>${monthsLeftStr}</strong></span>
              <span>🎯 <strong>${weeklyNeed.toFixed(2)} €/sem</strong></span>
            </div>`;
            else if (!g.targetDate && weeklyNeed > 0) {
              const recommended = Store.getRecommendedWeeklySaving();
              const rate = Math.max(weeklyNeed, recommended || weeklyNeed);
              const estMonths = Math.ceil(remaining / (rate * 4.33));
              timeInfo = `<div class="sa-goal-weekly" style="display:block;background:var(--bg)">
                <span>📅 A <strong>${rate.toFixed(2)} €/sem</strong> → ~<strong>${estMonths} meses</strong></span>
                <span style="font-size:11px;display:block;margin-top:3px;color:var(--primary)">✏️ Edita y pon fecha objetivo</span>
              </div>`;
            } else timeInfo = '';
            return `<div class="sa-goal">
              <div class="sa-goal-hdr">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="sa-goal-num">${i + 1}</span>
                  <span class="sa-goal-name">${esc(g.name)}</span>
                  ${g.currentAmount >= g.targetAmount ? '<span class="sa-goal-done">✅</span>' : ''}
                  ${g.targetDate && remaining > 0 ? `<span class="sa-goal-date-badge">${monthsLeftStr}</span>` : ''}
                </div>
                <div class="sa-goal-actions">
                  <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer" onclick="Presupuesto._contributeGoal('${g.id}')">+</button>
                  <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer" onclick="Presupuesto._editGoal('${g.id}')">✏️</button>
                  <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer" onclick="Presupuesto._deleteGoal('${g.id}')">✕</button>
                </div>
              </div>
              <div class="progress-bar sa-goal-bar"><div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--income)' : 'linear-gradient(90deg,#4F46E5,#10B981)'};border-radius:6px"></div></div>
              <div class="sa-goal-ftr">
                <span>${g.currentAmount.toFixed(0)} € / ${g.targetAmount.toFixed(0)} €</span>
                <span>${pct.toFixed(0)}%</span>
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
              </div>
              ${timeInfo}
            </div>`;
          }).join('')}
        </div>
        ${goals.length > 0 || totalSaved > 0 ? `<div class="sa-saving-total">Total ahorrado: <strong>${totalSaved.toFixed(2)} €</strong></div>` : ''}
      </div>

      ${this._renderPlannedExpenses(budget, limits, weekExpenses, recommendedWeeklySaving, available)}

      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 Resumen semanal</span>
          <span style="font-size:12px;color:var(--text-secondary)">${budget.daysLeft} días restantes</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          <div class="week-stat"><div class="week-stat-label">Presupuesto</div><div class="week-stat-value" style="color:var(--primary)">${budget.totalWeekly.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Gastado</div><div class="week-stat-value expense">${budget.actualExpense.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Restante</div><div class="week-stat-value" style="color:${budget.remaining >= 0 ? 'var(--income)' : 'var(--expense)'}">${budget.remaining.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Por día</div><div class="week-stat-value" style="color:var(--primary)">${Math.max(0,budget.daysLeft>0?budget.remaining/budget.daysLeft:0).toFixed(1)} €</div></div>
        </div>
        ${Object.keys(limits).filter(c => limits[c] > 0).length > 0 ? `
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">🏷️ Lo que te queda por categoría:</div>
          ${Object.entries(limits).filter(([,l]) => l > 0).map(([cat, limit]) => {
            const spent = weekExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
            const remain = limit - spent;
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const color = pct >= 100 ? 'var(--expense)' : pct >= 80 ? '#F97316' : pct >= 50 ? '#F59E0B' : 'var(--income)';
            return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0">
              <span style="font-weight:500">${cat}</span>
              <span style="color:${color};font-weight:600">${remain >= 0 ? `${remain.toFixed(1)} €` : `-${Math.abs(remain).toFixed(1)} €`}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
        ${budget.remaining <= 0 ? '<div style="margin-top:8px;padding:8px 12px;background:var(--expense-bg);color:var(--expense);border-radius:8px;font-weight:600;font-size:13px">🔴 Has superado tu presupuesto semanal</div>' : ''}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">🏷️ Límites semanales</span>
          <span style="font-size:11px;color:var(--text-secondary)">Por categoría</span>
        </div>
        ${Object.keys(limits).length > 0 ? (() => {
          const totalLimits = Object.values(limits).reduce((s, v) => s + v, 0);
          const exceeds = totalLimits > Math.max(0, available);
          return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:6px">
            <span>📊 Total límites: <strong>${totalLimits.toFixed(0)} €/sem</strong></span>
            <span>💸 Disponible plan: <strong style="color:var(--primary)">${Math.max(0, available).toFixed(2)} €/sem</strong></span>
            <span style="color:${exceeds ? 'var(--expense)' : 'var(--income)'}">${exceeds ? `🔴 Excede en ${(totalLimits - available).toFixed(2)}€` : '✅ En plan'}</span>
          </div>`;
        })() : ''}
        <div id="categoryLimitsList">${this._renderCategoryLimits(categories, limits, weekExpenses)}</div>
        <div class="add-cat-form" style="margin-top:10px">
          <select id="newLimitCategory" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            ${categories.filter(c => !limits[c]).map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <input type="number" id="newLimitAmount" placeholder="€" step="1" style="width:70px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          <button class="btn btn-primary" onclick="Presupuesto._addLimit()">+</button>
        </div>
        <div id="budgetLimitHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px;text-align:center;font-weight:600"></div>
      </div>

      <div class="sa-card sa-card-food">
        <div class="sa-food-header">
          <span>🍽️ Presupuesto mensual de Comida</span>
          <span class="sa-food-badge">Gasto obligatorio</span>
        </div>
        <div class="sa-food-config">
          <label>Presupuesto mensual (€)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="foodBudgetInput" step="5" value="${foodBudget}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700;max-width:120px">
            <button class="btn btn-primary btn-sm" onclick="Presupuesto._saveFoodBudget()">OK</button>
          </div>
        </div>
        <div class="sa-food-progress">
          <div class="sa-food-ring-wrap">
            ${ringSVG(foodPct, 80, 8, foodPct >= 100 ? '#EF4444' : foodPct >= 75 ? '#F59E0B' : '#10B981')}
            <div class="sa-food-ring-center"><div class="sa-food-ring-pct">${foodPct.toFixed(0)}%</div></div>
          </div>
          <div class="sa-food-info">
            <div class="sa-food-line"><span>Gastado este mes</span><span class="sa-food-val expense">${foodSpent.toFixed(2)} €</span></div>
            <div class="sa-food-line"><span>Presupuesto</span><span class="sa-food-val">${foodBudget.toFixed(0)} €</span></div>
            <div class="sa-food-line sa-food-line-total"><span>${foodRemaining > 0 ? 'Te quedan' : 'Te has pasado'}</span><span class="sa-food-val" style="color:${foodRemaining > 0 ? 'var(--income)' : 'var(--expense)'}">${foodSpent > foodBudget ? '+' : ''}${(foodBudget - foodSpent).toFixed(2)} €</span></div>
            ${foodDaily > 0 ? `<div class="sa-food-line"><span>Por día</span><span class="sa-food-val" style="color:var(--primary);font-weight:800">${foodDaily.toFixed(2)} €</span></div>` : ''}
          </div>
        </div>
        ${foodPct >= 100 ? '<div class="sa-food-alert">🔴 Has superado el presupuesto mensual de comida</div>' : foodPct >= 75 ? '<div class="sa-food-alert sa-food-alert-warn">🟡 Cuidado: ya has gastado el ' + foodPct.toFixed(0) + '% del presupuesto de comida</div>' : foodPct >= 50 ? '<div class="sa-food-alert sa-food-alert-ok">📊 Has gastado el ' + foodPct.toFixed(0) + '% del presupuesto de comida</div>' : ''}
      </div>

      <div class="sa-card" style="border-left:3px solid #EC4899">
        <div class="sa-food-header">
          <span>⚠️ Reserva para imprevistos</span>
          <span class="sa-food-badge" style="background:#EC4899;color:#fff">${imprevistosBudget > 0 ? `${imprevistosBudget.toFixed(0)} €/mes` : 'Sin reserva'}</span>
        </div>
        <div class="sa-food-config">
          <label>Reserva mensual (€)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="imprevistosBudgetInput" step="5" value="${imprevistosBudget}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700;max-width:120px">
            <button class="btn btn-primary btn-sm" onclick="Presupuesto._saveImprevistosBudget()">OK</button>
          </div>
        </div>
        ${imprevistosBudget > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
            <span>Gastado: <strong style="color:${imprevistosSpent > 0 ? 'var(--expense)' : 'var(--text)'}">${imprevistosSpent.toFixed(2)} €</strong></span>
            <span>Disponible: <strong style="color:${imprevistosRemaining > 0 ? 'var(--income)' : 'var(--text-secondary)'}">${imprevistosRemaining.toFixed(2)} €</strong></span>
            <span>${imprevistosWeekly.toFixed(2)} €/sem reservados</span>
          </div>
        </div>
        <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${imprevistosBudget > 0 ? Math.min(100, (imprevistosSpent / imprevistosBudget) * 100) : 0}%;background:#EC4899;border-radius:4px"></div></div>
        ${imprevistosSpent >= imprevistosBudget ? '<div style="margin-top:6px;padding:6px 10px;background:#FDF2F8;border-radius:6px;font-size:12px;color:#9D174D">🔴 Has agotado la reserva de imprevistos. Revisa si puedes aumentarla.</div>' : imprevistosBudget - imprevistosSpent > 0 ? '<div style="margin-top:6px;padding:6px 10px;background:#F0FDF4;border-radius:6px;font-size:12px;color:#166534">✅ Reserva disponible. Si no la usas, revisa al cerrar mes para pasar el sobrante a ahorro.</div>' : ''}
        ` : '<p style="font-size:13px;color:var(--text-secondary);padding:4px 0">Define una reserva mensual para gastos imprevistos. Lo que no uses podrás pasarlo a ahorro al cerrar el mes.</p>' }
        ${imprevistosSavings > 0 || imprevistosBudget > 0 ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <span style="font-size:13px;font-weight:600">🐷 Ahorro acumulado de imprevistos: <strong style="color:var(--primary)">${imprevistosSavings.toFixed(2)} €</strong></span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${imprevistosBudget > 0 && imprevistosRemaining > 0 ? `<button class="btn btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="Presupuesto._accumulateImprevistos()">📥 Acumular remanente (${imprevistosRemaining.toFixed(2)} €)</button>` : ''}
              ${imprevistosSavings > 0 ? `<button class="btn btn-sm btn-primary" style="border-radius:6px;font-size:11px" onclick="Presupuesto._transferImprevistosSavings()">💰 Pasar a ahorro</button>` : ''}
            </div>
          </div>
          ${imprevistosSavings > 0 ? '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Tus ahorros de imprevistos acumulados. Puedes transferirlos a tus metas de ahorro cuando quieras.</div>' : ''}
        </div>` : ''}
      </div>

      ${this._renderDebts()}
      ${this._renderRecurring()}
      ${this._renderRoundUps()}
      ${this._render503020(budget, allIncome, allExpenses)}

      <div class="card">
        <div class="card-header"><span class="card-title">💰 Tus ingresos</span></div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr;max-width:400px">
          <div class="form-group">
            <label>Semanal fijo (€)</label>
            <input type="number" id="budgetWeekly" step="1" value="${Store.getBudgetWeeklyIncome()}" style="font-size:16px;font-weight:600">
          </div>
          <div class="form-group">
            <label>Extra mensual (€)</label>
            <input type="number" id="budgetMonthly" step="1" value="${Store.getBudgetMonthlyExtra()}" style="font-size:16px;font-weight:600">
          </div>
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="Presupuesto._saveIncome()">Guardar</button>
      </div>

      ${this._renderOptimizer(weekExpenses, limits, budget, recommendedWeeklySaving, goals)}

      <div class="sa-card sa-card-tip">
        <div class="card-header"><span class="card-title">💡 Consejos inteligentes</span></div>
        <div id="adviceContent">${this._renderAdvice(budget, limits, weekExpenses, goals, foodBudget, foodSpent, foodPct, recommendedWeeklySaving)}</div>
      </div>
    `;
    document.getElementById('newLimitAmount').addEventListener('input', () => this._checkNewLimit());
    document.getElementById('newLimitCategory').addEventListener('change', () => this._checkNewLimit());
    document.getElementById('peAmount')?.addEventListener('input', () => this._pePreview());
    document.getElementById('peDate')?.addEventListener('change', () => this._pePreview());
  },

  _getMonthFoodSpending() {
    const month = Store.getCurrentMonth();
    return Store.getTransactions().filter(t => t.month === month && (t.category === 'Comida' || t.category === 'Bebida')).reduce((s, t) => s + t.amount, 0);
  },

  _getMonthDaysLeft() {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(0, lastDay - now.getDate());
  },

  _checkNewLimit() {
    const el = document.getElementById('budgetLimitHint');
    if (!el) return;
    const cat = document.getElementById('newLimitCategory')?.value;
    const amt = parseFloat(document.getElementById('newLimitAmount')?.value) || 0;
    if (!cat || amt <= 0) { el.style.display = 'none'; return; }
    const budget = this._calc();
    const limits = Store.getCategoryLimits();
    const totalOtherLimits = Object.entries(limits).filter(([c]) => c !== cat).reduce((s, [, v]) => s + v, 0);
    const foodBudget = Store.getFoodBudget();
    const foodWeekly = foodBudget / 4.33;
    const goals = Store.getSavingGoals();
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();
    const imprevistosBudget = Store.getImprevistosBudget();
    const imprevistosWeekly = imprevistosBudget / 4.33;
    const totalDeductions = foodWeekly + recommendedWeeklySaving + peWeekly + imprevistosWeekly;
    const available = budget.totalWeekly - totalDeductions;
    const projectedTotalLimits = totalOtherLimits + amt;
    const exceeds = projectedTotalLimits > Math.max(0, available);
    el.style.display = 'block';
    if (exceeds) {
      el.style.background = 'var(--expense-bg)';
      el.style.color = 'var(--expense)';
      el.textContent = `🔴 Los límites totales (${projectedTotalLimits.toFixed(2)} €/sem) superan el disponible del plan (${Math.max(0, available).toFixed(2)} €/sem) en ${(projectedTotalLimits - available).toFixed(2)} €`;
      return;
    }
    const alert = this.getAlertLevel(cat, amt);
    if (!alert) { el.style.display = 'none'; return; }
    const { alreadySpent, projectedTotal, limit, level } = alert;
    if (!limit) {
      el.style.background = 'var(--income-bg)';
      el.style.color = 'var(--income)';
      el.textContent = `✅ Nuevo límite — No hay gastos de "${cat}" esta semana`;
      return;
    }
    const colors = { good: 'var(--income)', caution: '#F59E0B', warning: '#F97316', danger: 'var(--expense)' };
    const bgs = { good: 'var(--income-bg)', caution: '#FFFBEB', warning: '#FFFBEB', danger: 'var(--expense-bg)' };
    const labels = { good: 'Dentro del presupuesto', caution: '🟡 Cuidado', warning: '⚠️ Casi al límite', danger: '🔴 Excedido' };
    el.style.background = bgs[level];
    el.style.color = colors[level];
    el.textContent = `${labels[level]} — ${alreadySpent.toFixed(2)} € + ${amt.toFixed(2)} € = ${projectedTotal.toFixed(2)} € / ${limit.toFixed(2)} €`;
  },

  _renderCategoryLimits(categories, limits, weekExpenses) {
    const cats = categories.filter(c => limits[c]);
    if (cats.length === 0) return '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:8px">Añade límites a las categorías que más gastas</p>';
    return cats.map(cat => {
      const limit = limits[cat];
      const spent = weekExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const remain = limit - spent;
      const level = this._alertLevel(spent, limit);
      const barColor = { good: 'var(--income)', caution: '#F59E0B', warning: '#F97316', danger: 'var(--expense)' }[level];
      return `<div class="budget-cat-item" data-cat="${cat}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;font-size:14px">${cat}</span>
          <span style="font-size:13px"><strong style="color:${spent <= limit ? 'var(--text)' : 'var(--expense)'}">${spent.toFixed(1)}</strong><span style="color:var(--text-secondary)"> / ${limit.toFixed(0)} €</span></span>
        </div>
        <div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${pct}%;background:${barColor};border-radius:5px"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:2px">
          <span>${pct.toFixed(0)}%</span>
          <span>${remain >= 0 ? `Restan ${remain.toFixed(1)} €` : `${(spent - limit).toFixed(1)} € excedido`}</span>
        </div>
        <button class="btn-sm" style="margin-top:4px;border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer" onclick="Presupuesto._removeLimit('${esc(cat)}')">✕</button>
      </div>`;
    }).join('');
  },

  _render503020(budget, allIncome, allExpenses) {
    const totalIncome = allIncome.reduce((s, t) => s + t.amount, 0);
    const monthly = Math.max(totalIncome || budget.totalWeekly * 4.33, budget.totalWeekly * 4.33);
    const skipCats = ['Ahorro','Ahorro programado'];
    const needsCats = ['Comida','Bebida','Vivienda','Transporte','Salud','Educación'];
    const needs = allExpenses.filter(t => needsCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
    const wants = allExpenses.filter(t => !needsCats.includes(t.category) && !skipCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
    const savings = Store.getSavingGoals().reduce((s, g) => s + g.currentAmount, 0) + (Store.getTotalRoundUpSavings() || 0);
    const pctNeeds = monthly > 0 ? (needs / monthly) * 100 : 0;
    const pctWants = monthly > 0 ? (wants / monthly) * 100 : 0;
    const pctSavings = monthly > 0 ? (savings / monthly) * 100 : 0;
    return `<div class="card">
      <div class="card-header"><span class="card-title">📐 Regla 50/30/20</span><span style="font-size:11px;color:var(--text-secondary)">Ingreso mensual: ${monthly.toFixed(0)} €</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${this._ruleBar('Necesidades (Comida, Vivienda...)','#10B981',pctNeeds,50,needs)}
        ${this._ruleBar('Deseos','#F59E0B',pctWants,30,wants)}
      </div>
      ${this._ruleBar('Ahorro','#4F46E5',pctSavings,20,savings)}
    </div>`;
  },

  _ruleBar(label, color, actual, target, amount) {
    const income = Math.max(Store.getTransactions().filter(t=>t.type==='Ingreso').reduce((s,t)=>s+t.amount,0), 1);
    const ratio = target > 0 ? actual / target : 0;
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
        <span style="font-weight:600">${label}</span>
        <span style="color:${ratio > 1.1 ? 'var(--expense)' : 'var(--text-secondary)'}">${actual.toFixed(1)}% · objetivo ${target}%</span>
      </div>
      <div class="progress-bar" style="height:18px"><div class="progress-fill" style="width:${Math.min(100,actual)}%;background:${color};border-radius:9px;opacity:${ratio > 1.1 ? '0.5' : '1'}"></div></div>
    </div>`;
  },

  _renderDebts() {
    const debts = Store.getDebts();
    const active = debts.filter(d => !d.isPaid);
    const paid = debts.filter(d => d.isPaid);
    return `
    <div class="card" style="border-left:3px solid #F59E0B">
      <div class="card-header">
        <span class="card-title">📋 Deudas a favor</span>
        <span style="font-size:12px;color:var(--text-secondary)">${active.length} pendiente${active.length !== 1 ? 's' : ''} · ${paid.length} cobrada${paid.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="sa-food-config">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input type="text" id="debtPerson" placeholder="¿Quién debe?" style="flex:1;min-width:100px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
          <input type="number" id="debtAmount" placeholder="€" step="1" style="width:80px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:700">
          <input type="text" id="debtDesc" placeholder="Concepto (opcional)" style="flex:1;min-width:100px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
          <button class="btn btn-primary btn-sm" onclick="Presupuesto._addDebt()">+ Añadir</button>
        </div>
      </div>
      ${active.length > 0 ? `
      <div style="margin-top:10px">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">⏳ Pendientes (${active.length})</div>
        ${active.map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <span style="font-size:14px">👤</span>
            <div>
              <div style="font-weight:600">${esc(d.person)}</div>
              ${d.description ? `<div style="font-size:11px;color:var(--text-secondary)">${esc(d.description)}</div>` : ''}
              <div style="font-size:10px;color:var(--text-secondary)">${d.date}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:700;font-size:15px;color:var(--income)">${d.amount.toFixed(2)} €</span>
            <button class="btn btn-sm btn-primary" style="border-radius:6px;font-size:11px" onclick="Presupuesto._payDebt('${d.id}')">💰 Cobrar</button>
            <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer;font-size:11px" onclick="Presupuesto._deleteDebt('${d.id}')">✕</button>
          </div>
        </div>`).join('')}
        <div style="font-size:13px;font-weight:700;text-align:right;padding:6px 0;color:var(--income)">Total: ${active.reduce((s, d) => s + d.amount, 0).toFixed(2)} €</div>
      </div>` : '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:8px 0;margin:0">No hay deudas pendientes 🎉</p>'}
      ${paid.length > 0 ? `
      <details style="margin-top:8px">
        <summary style="font-size:12px;color:var(--text-secondary);cursor:pointer">✅ Cobradas (${paid.length})</summary>
        <div style="margin-top:4px">
          ${paid.slice().reverse().slice(0, 10).map(d => `
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
            <span>${esc(d.person)}${d.description ? ': ' + esc(d.description) : ''}</span>
            <span style="color:var(--text-secondary)">${d.amount.toFixed(2)} € → ${d.paidTo === 'checkingBase' ? 'Base' : d.paidTo === 'checkingFree' ? 'Saldo libre' : 'Ahorro'} (${d.paidDate})</span>
          </div>`).join('')}
        </div>
      </details>` : ''}
    </div>`;
  },

  _renderRecurring() {
    const items = Store.getRecurringTransactions();
    const cats = Store.getCategories();
    const methods = Store.getPaymentMethods();
    const freqLabels = { weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };
    return `<div class="card" style="border-left:3px solid #06B6D4">
      <div class="card-header">
        <span class="card-title">🔁 Movimientos recurrentes</span>
        <span class="tip-hint" data-tip="Suscripciones, nóminas y pagos fijos. Se generan automáticamente en la fecha indicada.">ℹ️</span>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Configura pagos que se repiten (Netflix, alquiler, nómina...) y se registrarán solos.</p>
      <div class="rec-form">
        <input type="text" id="recName" placeholder="Nombre (ej: Netflix)" class="rec-input rec-input-wide">
        <input type="number" id="recAmount" placeholder="€" step="1" class="rec-input rec-input-narrow">
        <select id="recType" class="rec-input"><option value="Gasto">Gasto</option><option value="Ingreso">Ingreso</option></select>
        <select id="recCategory" class="rec-input">${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>
        <select id="recFreq" class="rec-input" onchange="Presupuesto._toggleRecDay()">
          <option value="monthly">Mensual</option>
          <option value="weekly">Semanal</option>
          <option value="yearly">Anual</option>
        </select>
        <input type="number" id="recDay" placeholder="Día" min="1" max="31" value="${new Date().getDate()}" class="rec-input rec-input-narrow" title="Día del mes (1-31)">
        <select id="recDayOfWeek" class="rec-input" style="display:none" title="Día de la semana (0=Dom, 1=Lun...)">
          <option value="0">Dom</option>
          <option value="1" selected>Lun</option>
          <option value="2">Mar</option>
          <option value="3">Mié</option>
          <option value="4">Jue</option>
          <option value="5">Vie</option>
          <option value="6">Sáb</option>
        </select>
        <select id="recMethod" class="rec-input">${methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select>
        <button class="btn btn-primary btn-sm" onclick="Presupuesto._addRecurring()">+</button>
      </div>
      ${items.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary);text-align:center;padding:12px">Sin movimientos recurrentes</p>' : items.map(r => {
        const freqDetail = r.frequency === 'weekly'
          ? `Cada ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][r.dayOfWeek ?? 1]}`
          : r.frequency === 'yearly' ? 'Cada año' : `Día ${r.dayOfMonth || 1} de cada mes`;
        return `<div class="rec-item ${r.active ? '' : 'rec-item-paused'}">
          <div class="rec-item-main">
            <span class="rec-item-icon">${r.type === 'Ingreso' ? '💰' : '💸'}</span>
            <div>
              <div class="rec-item-name">${esc(r.name || r.category)}</div>
              <div class="rec-item-meta">${freqLabels[r.frequency] || r.frequency} · ${freqDetail} · ${esc(r.category)} · Próximo: ${r.nextDate?.split('-').reverse().join('/') || '—'}</div>
            </div>
          </div>
          <div class="rec-item-right">
            <strong class="${r.type === 'Ingreso' ? 'income' : 'expense'}">${r.type === 'Ingreso' ? '+' : '-'}${r.amount.toFixed(2)} €</strong>
            <div class="rec-item-actions">
              <button class="btn-sm" title="${r.active ? 'Pausar' : 'Activar'}" onclick="Presupuesto._toggleRecurring('${r.id}')">${r.active ? '⏸' : '▶'}</button>
              <button class="btn-sm" onclick="Presupuesto._deleteRecurring('${r.id}')">✕</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  _toggleRecDay() {
    const freq = document.getElementById('recFreq')?.value;
    const dayEl = document.getElementById('recDay');
    const dowEl = document.getElementById('recDayOfWeek');
    if (!dayEl) return;
    if (freq === 'weekly') {
      dayEl.style.display = 'none';
      if (dowEl) dowEl.style.display = '';
    } else {
      dayEl.style.display = '';
      dayEl.min = 1; dayEl.max = 31;
      if (!dayEl.value || dayEl.value < 1) dayEl.value = new Date().getDate();
      dayEl.title = freq === 'yearly' ? 'Día del mes (anual)' : 'Día del mes';
      if (dowEl) dowEl.style.display = 'none';
    }
  },

  _addRecurring() {
    const name = document.getElementById('recName').value.trim();
    const amount = parseFloat(document.getElementById('recAmount').value);
    const type = document.getElementById('recType').value;
    const category = document.getElementById('recCategory').value;
    const frequency = document.getElementById('recFreq').value;
    const dayVal = parseInt(document.getElementById('recDay').value, 10);
    const dowVal = parseInt(document.getElementById('recDayOfWeek')?.value ?? '1', 10);
    const paymentMethod = document.getElementById('recMethod').value;
    if (!name || !amount || amount <= 0) return;
    const today = new Date();
    let nextDate = today.toISOString().split('T')[0];
    const data = { name, amount, type, category, paymentMethod, frequency, active: true, nextDate };
    if (frequency === 'weekly') {
      data.dayOfWeek = isNaN(dowVal) ? 1 : dowVal;
    } else {
      data.dayOfMonth = isNaN(dayVal) ? today.getDate() : Math.max(1, Math.min(31, dayVal));
    }
    Store.addRecurringTransaction(data);
    document.getElementById('recName').value = '';
    document.getElementById('recAmount').value = '';
    this.render();
  },

  _toggleRecurring(id) {
    Store.toggleRecurringTransaction(id);
    this.render();
  },

  _deleteRecurring(id) {
    App.showConfirm('Eliminar recurrente', '¿Eliminar este movimiento recurrente?', () => {
      Store.deleteRecurringTransaction(id);
      this.render();
    });
  },

  _renderRoundUps() {
    const enabled = Store.isRoundUpEnabled();
    const total = Store.getTotalRoundUpSavings();
    const goals = Store.getSavingGoals();
    const goalId = Store.getRoundUpGoalId();
    return `<div class="card">
      <div class="card-header">
        <span class="card-title">🔄 Redondeo automático</span>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer">
          <input type="checkbox" ${enabled ? 'checked' : ''} onchange="Presupuesto._toggleRoundUp()">
          ${enabled ? 'Activado' : 'Desactivado'}
        </label>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Cada gasto se redondea al euro y la diferencia se ahorra. ${enabled && total > 0 ? `<strong>Ahorrado: ${total.toFixed(2)} €</strong>` : ''}</p>
      ${goals.length > 0 ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="font-size:13px">Destinar a:</span>
        <select id="roundUpGoalSelect" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--radius)" onchange="Presupuesto._setRoundUpGoal()">
          <option value="">Sin destino</option>
          ${goals.map(g => `<option value="${g.id}" ${g.id === goalId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>`;
  },

  _renderPlannedExpenses(budget, limits, weekExpenses, recommendedWeeklySaving, available) {
    const expenses = Store.getPlannedExpenses();
    const afterFood = budget.totalWeekly - (Store.getFoodBudget() / 4.33);

    return `<div class="card">
      <div class="card-header">
        <span class="card-title">📋 Planificar gasto futuro</span>
        <span style="font-size:11px;color:var(--text-secondary)">Ahorra sin esfuerzo</span>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Si tienes un gasto grande en mente, te ayudo a planificar cuánto ahorrar por semana para pagarlo sin apuros.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding:10px;background:var(--bg);border-radius:8px">
        <input type="text" id="peName" placeholder="¿Qué gasto?" style="flex:2;min-width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
        <input type="number" id="peAmount" placeholder="Importe €" step="10" style="flex:1;min-width:80px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
        <input type="date" id="peDate" style="flex:1;min-width:100px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">
        <button class="btn btn-primary btn-sm" onclick="Presupuesto._addPlannedExpense()">➕</button>
      </div>
      <div id="pePreview" style="display:none;margin-bottom:8px;padding:8px 10px;border-radius:6px;font-size:12px;font-weight:600"></div>
      ${expenses.length === 0 ? '<p style="text-align:center;padding:12px;font-size:13px;color:var(--text-secondary)">Sin gastos planificados todavía</p>' : expenses.map(p => {
        const now = new Date();
        const tgt = new Date(p.targetDate + 'T23:59:59');
        const weeksLeft = Math.max(1, (tgt - now) / (7 * 86400000));
        const weeklyNeed = (p.amount - (p.savedSoFar || 0)) / weeksLeft;
        const pct = p.amount > 0 ? Math.min(100, ((p.savedSoFar || 0) / p.amount) * 100) : 0;
        const fits = weeklyNeed <= afterFood;
        const statusColor = fits ? 'var(--income)' : 'var(--expense)';
        const statusLabel = fits ? '✅ Cómodo' : '🔴 Requiere ajuste';
        const suggs = [];
        if (!fits) {
          Object.entries(limits).filter(([c]) => ['Salidas','Caprichos','Otros','Transporte','Ocio'].includes(c)).forEach(([cat, limit]) => {
            const spent = weekExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
            if (spent > limit * 0.3) {
              const suggested = Math.max(5, Math.round(limit * 0.5));
              const saving = spent - suggested;
              if (saving > 2) suggs.push(`"${cat}" de ${limit}€ → ${suggested}€ (ahorras ${saving.toFixed(0)}€/sem)`);
            }
          });
        }
        const gcalDate = p.targetDate ? p.targetDate.replace(/-/g, '') : '';
        const gcalUrl = gcalDate ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(p.name)}&dates=${gcalDate}/${gcalDate}&details=${encodeURIComponent('Gasto planificado: ' + p.amount + ' €. Ahorra ' + weeklyNeed.toFixed(2) + ' €/semana para pagarlo.')}&sf=true&output=xml` : '';
        return `<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:700;font-size:14px">${esc(p.name)} · <span style="color:var(--primary)">${p.amount.toFixed(0)} €</span></span>
            <div style="display:flex;gap:4px">
              ${gcalUrl ? `<a href="${gcalUrl}" target="_blank" class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer;text-decoration:none;font-size:11px;padding:2px 6px" title="Añadir a Google Calendar">📅</a>` : ''}
              <button class="btn-sm" style="border:none;background:none;cursor:pointer;color:var(--text-secondary)" onclick="Presupuesto._deletePlannedExpense('${p.id}')">✕</button>
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin-bottom:4px">
            <span>🎯 <strong>${weeklyNeed.toFixed(2)} €/sem</strong> · ${Math.ceil(weeksLeft)} semanas</span>
            <span style="color:${statusColor};font-weight:600">${statusLabel}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar" style="flex:1;height:5px"><div class="progress-fill" style="width:${pct}%;background:var(--primary);border-radius:3px"></div></div>
            <span style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${(p.savedSoFar || 0).toFixed(1)}€ / ${p.amount.toFixed(0)}€</span>
          </div>
          ${!fits && suggs.length > 0 ? `<div style="margin-top:6px;padding:6px 8px;background:#FFFBEB;border-radius:6px;font-size:11px;color:#92400E">💡 ${suggs.slice(0,2).join('<br>💡 ')}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  },

  _renderAdvice(budget, limits, weekExpenses, goals, foodBudget, foodSpent, foodPct, recommendedWeeklySaving) {
    const tips = [];
    const { totalWeekly, actualExpense, remaining, daysLeft } = budget;
    if (daysLeft > 0 && totalWeekly > 0) {
      const spentPct = (actualExpense / totalWeekly) * 100;
      const pctWeek = ((7 - daysLeft) / 7) * 100;
      const pace = spentPct - pctWeek;
      if (pace > 15) tips.push(`🔴 Gastaste ${spentPct.toFixed(0)}% del presupuesto pero pasó ${pctWeek.toFixed(0)}% de la semana. Reduce el ritmo.`);
      else if (pace < -10) tips.push(`✅ Buen ritmo: ${spentPct.toFixed(0)}% gastado en ${pctWeek.toFixed(0)}% de la semana.`);
      else tips.push(`📊 Vas bien encaminado. Quedan ${remaining.toFixed(2)} € para ${daysLeft} días.`);
    }
    if (foodBudget > 0) {
      if (foodPct >= 100) tips.push(`🍽️ Has superado el presupuesto de comida (${foodSpent.toFixed(0)}€ de ${foodBudget.toFixed(0)}€). Revisa tus gastos.`);
      else if (foodPct >= 75) tips.push(`🍽️ Cuidado con la comida: ${foodPct.toFixed(0)}% del presupuesto gastado. Quedan ${(foodBudget - foodSpent).toFixed(0)}€ para el mes.`);
      else tips.push(`🍽️ Gastos de comida controlados: ${foodSpent.toFixed(0)}€ de ${foodBudget.toFixed(0)}€ (${foodPct.toFixed(0)}%).`);
    }
    Object.entries(limits).filter(([cat,limit])=>{
      const s = weekExpenses.filter(t=>t.category===cat).reduce((a,t)=>a+t.amount,0);
      return s > limit * 0.8;
    }).forEach(([cat,limit])=>{
      const s = weekExpenses.filter(t=>t.category===cat).reduce((a,t)=>a+t.amount,0);
      tips.push(s > limit ? `🔴 ${cat}: ${s.toFixed(1)}€ de ${limit.toFixed(1)}€ — superado` : `🟡 ${cat}: ${s.toFixed(1)}€ de ${limit.toFixed(1)}€`);
    });
    if (remaining > 10 && goals.some(g => g.currentAmount < g.targetAmount)) {
      tips.push(`💪 Te sobran ${remaining.toFixed(0)}€ esta semana. Aporta ${Math.min(remaining, recommendedWeeklySaving || 5).toFixed(0)}€ a tu meta de ahorro.`);
    }
    if (recommendedWeeklySaving > 0 && remaining > recommendedWeeklySaving) {
      tips.push(`💰 Tienes suficiente para tu ahorro semanal (${recommendedWeeklySaving.toFixed(0)}€). ¡No lo dejes pasar!`);
    }
    const totalSaved = goals.reduce((s,g)=>s+g.currentAmount,0)+(Store.getTotalRoundUpSavings()||0);
    if (totalSaved > 0) tips.push(`🏦 Llevas ${totalSaved.toFixed(0)}€ ahorrados en total.`);
    if (tips.length === 0) tips.push('➕ Crea metas de ahorro y añade límites para recibir consejos personalizados.');
    return tips.map(t => `<div style="padding:4px 0;font-size:14px;line-height:1.5">${t}</div>`).join('');
  },

  _renderOptimizer(weekExpenses, limits, budget, recommendedWeeklySaving, goals) {
    const catSpend = {};
    weekExpenses.filter(t => t.type !== 'Ingreso').forEach(t => {
      const cat = t.category || 'Otros';
      catSpend[cat] = (catSpend[cat] || 0) + t.amount;
    });
    const discretionary = ['Salidas', 'Caprichos', 'Otros', 'Transporte', 'Ocio'];
    const suggestions = [];
    let totalAdjustable = 0;
    Object.entries(limits).forEach(([cat, limit]) => {
      const spent = catSpend[cat] || 0;
      const diff = spent - limit;
      const isDisc = discretionary.includes(cat);
      if (diff > 5 && isDisc) {
        const suggested = Math.round(limit * 0.75);
        const saving = spent - suggested;
        totalAdjustable += saving;
        suggestions.push({ cat, spent, limit, diff, suggested, saving, level: 'danger', msg: `Gastaste ${spent.toFixed(0)}€ de ${limit.toFixed(0)}€ en ${cat}. Reduce a ${suggested}€ → ahorras <strong>${saving.toFixed(0)}€/sem</strong>` });
      } else if (diff > 5 && !isDisc) {
        suggestions.push({ cat, spent, limit, diff, level: 'warn', msg: `🔴 ${cat}: ${spent.toFixed(0)}€ (límite ${limit.toFixed(0)}€). Necesitas controlarlo.` });
      } else if (spent > 0 && spent <= limit * 0.5 && isDisc) {
        const suggested = Math.round(limit * 0.5);
        const extra = suggested - spent;
        suggestions.push({ cat, spent, limit, diff: -extra, level: 'good', msg: `✅ ${cat}: ${spent.toFixed(0)}€ de ${limit.toFixed(0)}€. Bien controlado.` });
      }
    });
    const weeklyRemaining = budget.remaining;
    const extraSavings = totalAdjustable + Math.max(0, weeklyRemaining - 10);
    if (suggestions.length === 0 && extraSavings <= 0) return '';
    const hasGoals = goals.some(g => g.currentAmount < g.targetAmount);
    let impactHtml = '';
    if (extraSavings > 5 && hasGoals) {
      const firstGoal = goals.find(g => g.currentAmount < g.targetAmount);
      if (firstGoal) {
        const rem = firstGoal.targetAmount - firstGoal.currentAmount;
        const currentMonths = recommendedWeeklySaving > 0 ? Math.ceil(rem / (recommendedWeeklySaving * 4.33)) : 999;
        const fasterMonths = extraSavings > 0 ? Math.ceil(rem / ((recommendedWeeklySaving + extraSavings) * 4.33)) : currentMonths;
        const saved = currentMonths - fasterMonths;
        if (saved > 0) {
          impactHtml = `<div class="sa-opt-impact">🎯 Si ahorras ${(recommendedWeeklySaving + extraSavings).toFixed(2)}€/sem, "${firstGoal.name}" se alcanzaría <strong>${saved} meses antes</strong> (${fasterMonths} meses vs ${currentMonths})</div>`;
        }
      }
    }
    if (extraSavings > 5 && !hasGoals) {
      impactHtml = `<div class="sa-opt-impact">💪 Podrías ahorrar <strong>${extraSavings.toFixed(0)}€/sem</strong> extra. Crea una meta de ahorro para darle un objetivo.</div>`;
    }
    return `<div class="sa-card sa-card-opt">
      <div class="card-header"><span class="card-title">🔍 Optimizador de presupuesto</span></div>
      <div class="sa-opt-summary">Basado en tus gastos de esta semana, estos son los ajustes recomendados para maximizar tu ahorro:</div>
      <div class="sa-opt-list">
        ${suggestions.map(s => `<div class="sa-opt-item sa-opt-${s.level}">
          <div class="sa-opt-item-hdr">
            <span class="sa-opt-cat">${s.cat}</span>
            <span class="sa-opt-spend" style="color:${s.level === 'danger' ? 'var(--expense)' : s.level === 'warn' ? '#F59E0B' : 'var(--income)'}">${s.spent.toFixed(0)}€ / ${s.limit.toFixed(0)}€</span>
          </div>
          <div class="sa-opt-msg">${s.msg}</div>
          ${s.suggested ? `<button class="btn-sm" style="margin-top:6px;background:var(--primary);color:white;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px" onclick="Presupuesto._applySuggestion('${esc(s.cat)}', ${s.suggested})">Aplicar: ${s.cat} → ${s.suggested}€</button>` : ''}
        </div>`).join('')}
      </div>
      ${extraSavings > 0 ? `<div class="sa-opt-total">💡 Potencial de ahorro extra: <strong>${extraSavings.toFixed(2)} €/semana</strong> (${(extraSavings * 4.33).toFixed(2)} €/mes)</div>` : ''}
      ${impactHtml}
      ${weeklyRemaining > 10 ? `<div class="sa-opt-tip">Te sobran ${weeklyRemaining.toFixed(0)}€ esta semana. Destina al menos ${Math.min(weeklyRemaining, Math.max(5, recommendedWeeklySaving)).toFixed(0)}€ a tu meta de ahorro.</div>` : ''}
    </div>`;
  },

  _applySuggestion(cat, amount) {
    Store.setCategoryLimit(cat, amount);
    this.render();
  },

  _ensureDefaultLimits() {
    const limits = Store.getCategoryLimits();
    if (Object.keys(limits).length === 0) {
      Store.setCategoryLimit('Comida', 40);
      Store.setCategoryLimit('Salidas', 20);
      Store.setCategoryLimit('Caprichos', 10);
    }
  },

  _calc() {
    const weeklyIncome = Store.getBudgetWeeklyIncome();
    const monthlyExtra = Store.getBudgetMonthlyExtra();
    const totalWeekly = weeklyIncome + (monthlyExtra / 4.33);
    const week = this._getCurrentWeek();
    const allTx = Store.getTransactions().filter(t => !Store.isAdjustment(t));
    const weekTx = allTx.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d >= week.start && d <= week.end;
    });
    const actualExpense = weekTx.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const remaining = totalWeekly - actualExpense;
    const today = new Date();
    const daysLeft = Math.max(0, Math.ceil((week.end.getTime() - today.getTime()) / 86400000));
    const remainingDays = today.getHours() < 12 ? daysLeft + 1 : daysLeft;
    return { weeklyIncome, monthlyExtra, totalWeekly, actualExpense, remaining, daysLeft: remainingDays, week };
  },

  _getCurrentWeek() {
    const today = new Date();
    const dow = today.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  },

  _getWeekTransactions() {
    const week = this._getCurrentWeek();
    return Store.getTransactions().filter(t => {
      if (Store.isAdjustment(t)) return false;
      const d = new Date(t.date + 'T00:00:00');
      return d >= week.start && d <= week.end;
    });
  },

  _alertLevel(spent, limit) {
    if (limit <= 0) return 'good';
    const pct = (spent / limit) * 100;
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warning';
    if (pct >= 50) return 'caution';
    return 'good';
  },

  getAlertLevel(category, amount) {
    const limits = Store.getCategoryLimits();
    const limit = limits[category];
    if (!limit) return null;
    const week = this._getCurrentWeek();
    const weekTx = Store.getTransactions().filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d >= week.start && d <= week.end && t.category === category;
    });
    const alreadySpent = weekTx.reduce((s, t) => s + t.amount, 0);
    const projectedTotal = alreadySpent + amount;
    return { limit, alreadySpent, projectedTotal, level: this._alertLevel(projectedTotal, limit) };
  },

  getRoundUp(amount) {
    if (!Store.isRoundUpEnabled()) return 0;
    return Math.ceil(amount) - amount;
  },

  _saveIncome() {
    Store.setBudgetWeeklyIncome(parseFloat(document.getElementById('budgetWeekly').value) || 70);
    Store.setBudgetMonthlyExtra(parseFloat(document.getElementById('budgetMonthly').value) || 100);
    this.render();
  },

  _saveFoodBudget() {
    const v = parseFloat(document.getElementById('foodBudgetInput').value);
    if (v > 0) Store.setFoodBudget(v);
    this.render();
  },
  _savePlanFood() {
    const v = parseFloat(document.getElementById('planFoodBudget').value);
    if (v > 0) { Store.setFoodBudget(v); this.render(); }
  },

  _saveImprevistosBudget() {
    const v = parseFloat(document.getElementById('imprevistosBudgetInput').value);
    if (v >= 0) { Store.setImprevistosBudget(v); this.render(); }
  },

  _addLimit() {
    const cat = document.getElementById('newLimitCategory').value;
    const amt = parseFloat(document.getElementById('newLimitAmount').value);
    if (!cat || !amt || amt <= 0) return;
    const budget = this._calc();
    const limits = Store.getCategoryLimits();
    const totalExisting = Object.values(limits).reduce((s, v) => s + v, 0);
    const oldCatLimit = limits[cat] || 0;
    const newTotal = totalExisting - oldCatLimit + amt;
    const foodBudget = Store.getFoodBudget();
    const foodWeekly = foodBudget / 4.33;
    const goals = Store.getSavingGoals();
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();
    const imprevistosBudget = Store.getImprevistosBudget();
    const imprevistosWeekly = imprevistosBudget / 4.33;
    const totalDeductions = foodWeekly + recommendedWeeklySaving + peWeekly + imprevistosWeekly;
    const available = budget.totalWeekly - totalDeductions;
    if (newTotal > Math.max(0, available)) {
      App.showToast(`🔴 Límite no añadido — total (${newTotal.toFixed(2)}€) supera el disponible (${Math.max(0,available).toFixed(2)}€)`);
      return;
    }
    Store.setCategoryLimit(cat, amt);
    this.render();
  },

  _removeLimit(cat) { Store.removeCategoryLimit(cat); this.render(); },

  _addGoal() {
    document.getElementById('modalTitle').textContent = 'Nueva meta de ahorro';
    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group"><label>Nombre</label><input type="text" id="goalNameInput" placeholder="Ej: Navidad 2026" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
        <div class="form-group"><label>Objetivo (€)</label><input type="number" id="goalTargetInput" placeholder="500" step="10" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
        <div class="form-group"><label>¿Para cuándo quieres conseguirlo?</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(3)">3 meses</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(6)">6 meses</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(12)">1 año</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(24)">2 años</button>
          </div>
          <input type="date" id="goalDateInput" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%">
        </div>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center" id="goalDatePreview">Sin fecha definida — calcularemos el tiempo estimado</div>
      </div>
    `;
    document.getElementById('goalDateInput').addEventListener('change', () => { this._updateGoalDatePreview(); });
    document.getElementById('modalConfirm').onclick = () => {
      const name = document.getElementById('goalNameInput').value.trim();
      const target = parseFloat(document.getElementById('goalTargetInput').value);
      const date = document.getElementById('goalDateInput').value;
      if (!name || !target || target <= 0) return;
      Store.addSavingGoal(name, target, date || undefined);
      App._closeModal();
      this.render();
    };
    document.getElementById('modalCancel').onclick = () => App._closeModal();
    document.getElementById('modalOverlay').classList.add('open');
    this._updateGoalDatePreview();
  },

  _quickDate(months) {
    const d = new Date(); d.setMonth(d.getMonth() + months);
    document.getElementById('goalDateInput').value = d.toISOString().split('T')[0];
    this._updateGoalDatePreview();
  },

  _updateGoalDatePreview() {
    const inp = document.getElementById('goalDateInput');
    const preview = document.getElementById('goalDatePreview');
    if (!inp || !preview) return;
    if (inp.value) {
      const d = new Date(inp.value + 'T00:00:00');
      const now = new Date();
      const months = Math.max(0, Math.round((d - now) / (30.44 * 86400000)));
      const weeks = Math.max(0, Math.round((d - now) / (7 * 86400000)));
      preview.textContent = `📅 ${d.toLocaleDateString('es')} — faltan ${months} meses (${weeks} semanas)`;
    } else {
      preview.textContent = 'Sin fecha — calcularemos el tiempo estimado según tu ritmo de ahorro';
    }
  },

  _editGoal(id) {
    const g = Store.getSavingGoals().find(x => x.id === id);
    if (!g) return;
    document.getElementById('modalTitle').textContent = 'Editar meta';
    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group"><label>Nombre</label><input type="text" id="goalNameInput" value="${esc(g.name)}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
        <div class="form-group"><label>Objetivo (€)</label><input type="number" id="goalTargetInput" value="${g.targetAmount}" step="10" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
        <div class="form-group"><label>Cantidad actual ahorrada (€)</label><input type="number" id="goalCurrentInput" value="${g.currentAmount}" step="1" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
        <div class="form-group"><label>¿Para cuándo quieres conseguirlo?</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(3)">3 meses</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(6)">6 meses</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(12)">1 año</button>
            <button class="btn-sm gc-range" onclick="Presupuesto._quickDate(24)">2 años</button>
          </div>
          <input type="date" id="goalDateInput" value="${g.targetDate || ''}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%">
        </div>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center" id="goalDatePreview"></div>
      </div>
    `;
    document.getElementById('goalDateInput').addEventListener('change', () => { this._updateGoalDatePreview(); });
    document.getElementById('modalConfirm').onclick = () => {
      const name = document.getElementById('goalNameInput').value.trim();
      const target = parseFloat(document.getElementById('goalTargetInput').value);
      const current = parseFloat(document.getElementById('goalCurrentInput').value) || 0;
      const date = document.getElementById('goalDateInput').value;
      if (!name || !target || target <= 0) return;
      Store.updateSavingGoal(id, { name, targetAmount: target, currentAmount: Math.min(current, target), targetDate: date || '' });
      App._closeModal();
      this.render();
    };
    document.getElementById('modalCancel').onclick = () => App._closeModal();
    document.getElementById('modalOverlay').classList.add('open');
    this._updateGoalDatePreview();
  },

  _contributeGoal(id) {
    const g = Store.getSavingGoals().find(x => x.id === id);
    if (!g || g.currentAmount >= g.targetAmount) return;
    document.getElementById('modalTitle').textContent = `Aportar a "${g.name}"`;
    document.getElementById('modalBody').innerHTML = `
      <div class="form-group">
        <label>Cantidad a añadir (€)</label>
        <input type="number" id="goalContributeInput" value="5" step="1" min="0.01" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">Faltan ${(g.targetAmount - g.currentAmount).toFixed(0)} € para alcanzar la meta</p>
    `;
    document.getElementById('modalConfirm').onclick = () => {
      const amt = parseFloat(document.getElementById('goalContributeInput').value);
      if (!amt || amt <= 0) return;
      Store.contributeToGoal(id, amt);
      App._closeModal();
      this.render();
    };
    document.getElementById('modalCancel').onclick = () => App._closeModal();
    document.getElementById('modalOverlay').classList.add('open');
  },

  _deleteGoal(id) {
    const g = Store.getSavingGoals().find(x => x.id === id);
    if (!g) return;
    App.showConfirm('Eliminar meta', `¿Eliminar "${g.name}"?`, () => { Store.deleteSavingGoal(id); this.render(); });
  },

  _toggleRoundUp() { Store.toggleRoundUp(); this.render(); },
  _setRoundUpGoal() { Store.setRoundUpGoalId(document.getElementById('roundUpGoalSelect').value || null); },

  _pePreview() {
    const el = document.getElementById('pePreview');
    if (!el) return;
    const amount = parseFloat(document.getElementById('peAmount')?.value);
    const date = document.getElementById('peDate')?.value;
    if (!amount || amount <= 0 || !date) { el.style.display = 'none'; return; }
    const weeks = Math.max(1, (new Date(date + 'T23:59:59') - new Date()) / (7 * 86400000));
    const wk = amount / weeks;
    el.style.display = 'block';
    el.style.background = wk <= (Store.getFoodBudget() / 4.33) ? 'var(--income-bg)' : '#FFFBEB';
    el.style.color = wk <= (Store.getFoodBudget() / 4.33) ? 'var(--income)' : '#b45309';
    el.textContent = `Necesitas ahorrar ${wk.toFixed(2)} €/semana durante ${Math.ceil(weeks)} semanas.`;
  },

  _addPlannedExpense() {
    const name = document.getElementById('peName').value.trim();
    const amount = parseFloat(document.getElementById('peAmount').value);
    const date = document.getElementById('peDate').value;
    if (!name || !amount || amount <= 0 || !date) return;
    Store.addPlannedExpense(name, amount, date);
    document.getElementById('peName').value = '';
    document.getElementById('peAmount').value = '';
    document.getElementById('peDate').value = '';
    document.getElementById('pePreview').style.display = 'none';
    this.render();
  },

  _deletePlannedExpense(id) {
    App.showConfirm('Eliminar', '¿Eliminar este gasto planificado?', () => { Store.deletePlannedExpense(id); this.render(); });
  },

  _accumulateImprevistos() {
    const unused = Store.addUnusedImprevistosToSavings();
    if (unused > 0) {
      App.showCustom('📥 Remanente acumulado', `<p style="font-size:14px">Has acumulado <strong>${unused.toFixed(2)} €</strong> del remanente de imprevistos en tu bote de ahorro de imprevistos.</p><p style="font-size:13px;color:var(--text-secondary);margin-top:6px">Total acumulado: <strong>${Store.getImprevistosSavings().toFixed(2)} €</strong></p>`, 'OK', () => { App._closeModal(); this.render(); });
    }
  },

  _addDebt() {
    const person = document.getElementById('debtPerson').value.trim();
    const amount = parseFloat(document.getElementById('debtAmount').value);
    const desc = document.getElementById('debtDesc').value.trim();
    if (!person || !amount || amount <= 0) return;
    Store.addDebt(person, amount, desc);
    document.getElementById('debtPerson').value = '';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDesc').value = '';
    this.render();
  },

  _deleteDebt(id) {
    App.showConfirm('Eliminar deuda', '¿Eliminar esta deuda?', () => { Store.deleteDebt(id); this.render(); });
  },

  _payDebt(id) {
    const debts = Store.getDebts();
    const debt = debts.find(d => d.id === id);
    if (!debt || debt.isPaid) return;
    App.showCustom(`💰 Cobrar deuda`,
      `<p style="font-size:14px">Vas a cobrar <strong>${debt.amount.toFixed(2)} €</strong> de <strong>${esc(debt.person)}</strong>${debt.description ? ' (' + esc(debt.description) + ')' : ''}.</p>
      <p style="font-size:13px;margin:8px 0;font-weight:600">¿Dónde quieres ingresar este dinero?</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
          <input type="radio" name="debtDest" value="checkingBase" checked>
          <span style="font-weight:600">🔒 Base cuenta corriente</span>
          <span style="font-size:11px;color:var(--text-secondary);margin-left:auto">Dinero reservado que no se gasta</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
          <input type="radio" name="debtDest" value="checkingFree">
          <span style="font-weight:600">💸 Saldo libre</span>
          <span style="font-size:11px;color:var(--text-secondary);margin-left:auto">Disponible para gastar</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
          <input type="radio" name="debtDest" value="savings">
          <span style="font-weight:600">💰 Cuenta de ahorro</span>
          <span style="font-size:11px;color:var(--text-secondary);margin-left:auto">Para tus metas de ahorro</span>
        </label>
      </div>`,
      '✅ Cobrar', () => {
        const dest = document.querySelector('input[name="debtDest"]:checked')?.value;
        if (!dest) return;
        Store.payDebt(id, dest);
        App._closeModal();
        this.render();
      }
    );
  },

  _transferImprevistosSavings() {
    const available = Store.getImprevistosSavings();
    if (available <= 0) return;
    const goals = Store.getSavingGoals().filter(g => g.currentAmount < g.targetAmount);
    if (goals.length === 0) {
      App.showCustom('Sin metas', '<p style="font-size:14px">No tienes metas de ahorro activas. Crea una meta primero.</p>', 'Cerrar', () => App._closeModal());
      return;
    }
    const goalsHtml = goals.map(g => {
      const remaining = (g.targetAmount - g.currentAmount).toFixed(2);
      return `<div style="font-size:13px;padding:2px 0">🎯 ${esc(g.name)} — faltan ${remaining} €</div>`;
    }).join('');
    App.showCustom('💰 Transferir ahorro de imprevistos',
      `<p style="font-size:14px">Tienes <strong>${available.toFixed(2)} €</strong> acumulados de imprevistos. Indica cuánto quieres transferir a tus metas de ahorro:</p>
      <input type="number" id="transferImpAmount" value="${available.toFixed(0)}" step="1" min="0.01" max="${available}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);margin:8px 0;font-size:18px;font-weight:700">
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Se distribuirá entre estas metas:</div>
      ${goalsHtml}`,
      '✅ Transferir', () => {
        const val = parseFloat(document.getElementById('transferImpAmount').value);
        if (!val || val <= 0) return;
        const result = Store.distributeImprevistosSavings(val);
        if (result > 0) {
          App._closeModal();
          this.render();
        }
      }
    );
  },

};
