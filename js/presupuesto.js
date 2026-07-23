const Presupuesto = {
  // Sections open by default: 'plan', 'limits', 'goals'. Others collapsed.
  _openSections: new Set(['plan', 'limits', 'goals']),

  _section(id, title, html, alwaysOpen = false) {
    const open = alwaysOpen || this._openSections.has(id);
    return `<div class="pres-section" data-section="${id}">
      <button class="pres-section-header ${open ? 'open' : ''}" onclick="Presupuesto._toggleSection('${id}')">
        <span>${title}</span>
        <span class="pres-section-chevron">${open ? '▲' : '▼'}</span>
      </button>
      <div class="pres-section-body" style="${open ? '' : 'display:none'}">
        ${html}
      </div>
    </div>`;
  },

  _toggleSection(id) {
    if (this._openSections.has(id)) this._openSections.delete(id);
    else this._openSections.add(id);
    const el = document.querySelector(`.pres-section[data-section="${id}"]`);
    if (!el) return;
    const btn = el.querySelector('.pres-section-header');
    const body = el.querySelector('.pres-section-body');
    const open = this._openSections.has(id);
    btn.classList.toggle('open', open);
    el.querySelector('.pres-section-chevron').textContent = open ? '▲' : '▼';
    body.style.display = open ? '' : 'none';
  },

  render() {
    this._ensureDefaultLimits();
    const budget = this._calc();
    const limits = Store.getCategoryLimits();
    const categories = Store.getCategories();
    const weekExpenses = this._getWeekTransactions(); // via BudgetEngine (already filtered to spendable)
    const allTx = Store.getTransactions().filter(t => !Store.isAdjustment(t));
    const allExpenses = allTx.filter(t => Store.isSpendableExpense(t));
    const allIncome = allTx.filter(t => t.type === 'Ingreso');
    // Month-scoped versions for 50/30/20 (match Dashboard scope)
    const monthTx = App.getCurrentTransactions().filter(t => !Store.isAdjustment(t));
    const monthExpenses = monthTx.filter(t => Store.isSpendableExpense(t));
    const monthIncome = monthTx.filter(t => t.type === 'Ingreso');
    const goals = Store.getSavingGoals();
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const totalSaved = goals.reduce((s,g) => s+g.currentAmount, 0);
    const foodBudget = Store.getEffectiveFoodBudget();
    const foodSpent = this._getMonthFoodSpending();
    const foodRemaining = Math.max(0, foodBudget - foodSpent);
    const monthDays = this._getMonthDaysLeft();
    const foodDaily = monthDays > 0 ? foodRemaining / monthDays : 0;
    const foodPct = foodBudget > 0 ? Math.min(100, (foodSpent / foodBudget) * 100) : 0;
    const el = document.getElementById('tab-presupuesto');
    const foodWeekly = foodBudget / 4.33;
    const categoryGroups = Store.getCategoryGroups();
    const foodGroups = categoryGroups.filter(g => g.isFoodGroup);
    const nonFoodGroups = categoryGroups.filter(g => !g.isFoodGroup && g.monthlyBudget > 0);
    const imprevistosInPlan = Store.isImprevistosInPlan();
    const imprevistosAutoAdjust = Store.isImprevistosAutoAdjust();
    const imprevistosRecommended = Store.getRecommendedImprevistosBudget();
    const imprevistosBudget = Store.getImprevistosBudget();
    const imprevistosEffective = Store.getEffectiveImprevistosBudget();
    const imprevistosWeekly = imprevistosEffective / 4.33;
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
    if (available <= 0 && budget.totalWeekly > 0) planAdvice.push(`🔴 Tus gastos planificados superan tus ingresos. Revisa metas, imprevistos o gastos planificados.`);
    else if (available <= 0 && budget.totalWeekly <= 0) planAdvice.push(`📊 Añade movimientos de ingreso y gasto — la app estimará tu presupuesto automáticamente. Opcional: configura ingresos en ⚙️ Ajustes.`);
    else if (available < recommendedWeeklySaving) planAdvice.push(`💪 El ${savePctIncome.toFixed(0)}% de tus ingresos va a ahorro. Te quedan ${available.toFixed(2)}€/sem para gastar.`);
    else planAdvice.push(`✅ Plan equilibrado: ${foodPctIncome.toFixed(0)}% comida · ${savePctIncome.toFixed(0)}% ahorro · ${availPctIncome.toFixed(0)}% gastos.`);
    if (available > 0) planAdvice.push(`💡 Prioriza gastar de tus ingresos semanales antes de usar el saldo de tu cuenta. La base guardada no se toca.`);
    if (recommendedWeeklySaving > 0 && available >= recommendedWeeklySaving) planAdvice.push(`💰 Cumples tu objetivo de ahorro semanal (${recommendedWeeklySaving.toFixed(2)}€/sem) con margen.`);
    else if (recommendedWeeklySaving > 0 && available > 0) planAdvice.push(`🎯 Te quedan ${available.toFixed(2)}€/sem para gastar. Prioriza tu meta de ahorro antes de gastar.`);

    const savingsGuide = BudgetEngine.getSmartSavingsGuide();
    const sustainability = BudgetEngine.getSustainabilityMetrics();
    const uncategorized = BudgetEngine.getUncategorizedCategories();
    const effectiveIncome = BudgetEngine.getEffectiveIncome();
    const learnedBudget = BudgetEngine.getLearnedBudgetSuggestions();

    el.innerHTML = `
      ${uncategorized.length > 0 ? `
      <div style="margin:0 0 12px;padding:10px 14px;background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:10px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">⚠️</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--warn-text)">${uncategorized.length} categoría${uncategorized.length !== 1 ? 's' : ''} sin grupo de gasto</div>
          <div style="font-size:11px;color:var(--warn-text);margin-top:2px;opacity:.85">Asigna estas categorías a un grupo para que el plan financiero sea más preciso: ${uncategorized.slice(0,4).map(c => `<strong>${c.name}</strong>`).join(', ')}${uncategorized.length > 4 ? ` y ${uncategorized.length - 4} más` : ''}</div>
        </div>
        <button class="btn btn-sm" style="background:var(--warn);color:#fff;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer" onclick="App._switchTab('categorias')">Organizar →</button>
      </div>` : ''}

      <div class="sa-card" style="margin-bottom:12px;background:linear-gradient(135deg,${savingsGuide.color}15,var(--card));border:1px solid ${savingsGuide.color}40">
        <div class="card-header">
          <span class="card-title">🧭 Guía de ahorro personalizada</span>
          <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;background:${savingsGuide.color};color:#fff">${savingsGuide.label}</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">${savingsGuide.advice}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div style="padding:10px;background:var(--card);border-radius:8px;border-left:3px solid #4F46E5;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:var(--text-secondary)">💰 Ahorro recomendado</div>
            <div style="font-size:20px;font-weight:800;color:#4F46E5;margin:2px 0">${savingsGuide.savingPct}%</div>
            <div style="font-size:11px;color:var(--text-secondary)">${savingsGuide.weeklySaving.toFixed(2)} €/sem · ${savingsGuide.monthlySaving.toFixed(0)} €/mes</div>
            <div style="margin-top:5px;font-size:11px;color:${savingsGuide.currentWeeklySaving >= savingsGuide.weeklySaving * 0.9 ? 'var(--income)' : 'var(--expense)'};font-weight:600">
              Tienes: ${savingsGuide.currentWeeklySaving.toFixed(2)} €/sem ${savingsGuide.currentWeeklySaving >= savingsGuide.weeklySaving * 0.9 ? '✅' : '— necesitas más'}
            </div>
          </div>
          <div style="padding:10px;background:var(--card);border-radius:8px;border-left:3px solid #EC4899;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:var(--text-secondary)">⚠️ Imprevistos ${imprevistosInPlan ? '' : '(opcional)'}</div>
            <div style="font-size:20px;font-weight:800;color:#EC4899;margin:2px 0">${savingsGuide.imprevistosPct}%</div>
            <div style="font-size:11px;color:var(--text-secondary)">${savingsGuide.weeklyImprevisto.toFixed(2)} €/sem · ${savingsGuide.monthlyImprevisto.toFixed(0)} €/mes recomendados</div>
            ${imprevistosInPlan ? `<div style="margin-top:5px;font-size:11px;color:${savingsGuide.currentImprevistosBudget >= savingsGuide.monthlyImprevisto * 0.9 ? 'var(--income)' : 'var(--expense)'};font-weight:600">
              En tu plan: ${savingsGuide.currentImprevistosBudget.toFixed(0)} €/mes ${savingsGuide.currentImprevistosBudget >= savingsGuide.monthlyImprevisto * 0.9 ? '✅' : '— por debajo'}
              ${imprevistosAutoAdjust ? ' · <span style="color:var(--primary)">auto-reajuste</span>' : ''}
            </div>` : `<button class="btn btn-sm" style="margin-top:6px;border:1px solid #EC4899;background:#FDF2F8;color:#9D174D;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700" onclick="Presupuesto._enablePlanImprevistos()">+ Incluir en el plan (${imprevistosRecommended.toFixed(0)} €/mes)</button>`}
          </div>
        </div>
        <div style="padding:10px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">📊 SALUD FINANCIERA</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:24px">${sustainability.status === 'good' ? '🟢' : sustainability.status === 'warning' ? '🟡' : '🔴'}</span>
            <div>
              <div style="font-size:13px;font-weight:700">${sustainability.statusLabel}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${sustainability.statusAdvice}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div style="flex:1;min-width:80px;text-align:center;padding:6px;background:var(--bg);border-radius:6px">
              <div style="font-size:10px;color:var(--text-secondary)">Autonomía</div>
              <div style="font-size:16px;font-weight:800;color:${sustainability.monthsOfAutonomy >= 3 ? 'var(--income)' : 'var(--expense)'}">${sustainability.monthsOfAutonomy.toFixed(1)} meses</div>
            </div>
            <div style="flex:1;min-width:80px;text-align:center;padding:6px;background:var(--bg);border-radius:6px">
              <div style="font-size:10px;color:var(--text-secondary)">Tasa ahorro</div>
              <div style="font-size:16px;font-weight:800;color:${sustainability.savingRate >= 0.1 ? 'var(--income)' : sustainability.savingRate >= 0 ? 'var(--primary)' : 'var(--expense)'}">${(sustainability.savingRate * 100).toFixed(0)}%</div>
            </div>
            <div style="flex:1;min-width:80px;text-align:center;padding:6px;background:var(--bg);border-radius:6px">
              <div style="font-size:10px;color:var(--text-secondary)">En 6 meses</div>
              <div style="font-size:14px;font-weight:800;color:var(--primary)">${sustainability.projectedIn6Months.toFixed(0)} €</div>
            </div>
          </div>
        </div>
      </div>

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
          <div class="sa-plan-row"><span>💰 Ingreso semanal total
            ${effectiveIncome.source !== 'manual' ? `<span style="font-size:10px;color:var(--text-secondary);margin-left:4px">(${effectiveIncome.source === 'none' ? 'sin datos' : 'estimado'})</span>` : ''}
          </span><strong>${budget.totalWeekly.toFixed(2)} €</strong></div>
          ${effectiveIncome.sourceLabel ? `<div style="font-size:11px;color:var(--text-secondary);margin:-4px 0 8px;line-height:1.45">${esc(effectiveIncome.sourceLabel)} · <button type="button" class="linkish" onclick="App._switchTab('categorias')">Configurar ingresos →</button></div>` : ''}
          <div class="sa-plan-row sa-plan-row-adjust"><span>🍽️ Comida <span class="sa-plan-badge">obligatorio</span></span>
            <div><input type="number" id="planFoodBudget" value="${foodBudget}" step="5" class="sa-plan-input" onchange="Presupuesto._savePlanFood()"> €/mes <span class="sa-plan-sub">${foodWeekly.toFixed(2)} €/sem</span></div>
          </div>
          <div class="sa-plan-row sa-plan-row-adjust">
            <span>⚠️ Imprevistos
              <label style="font-size:11px;font-weight:500;margin-left:6px;cursor:pointer">
                <input type="checkbox" id="planImprevistosEnabled" ${imprevistosInPlan ? 'checked' : ''} onchange="Presupuesto._togglePlanImprevistos()" style="margin-right:3px">Incluir
              </label>
            </span>
            ${imprevistosInPlan ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
              <input type="number" id="planImprevistosBudget" value="${imprevistosBudget}" step="5" min="0" class="sa-plan-input" onchange="Presupuesto._savePlanImprevistos()"> €/mes
              <span class="sa-plan-sub">${imprevistosWeekly.toFixed(2)} €/sem</span>
              <label style="font-size:10px;color:var(--text-secondary);cursor:pointer;white-space:nowrap">
                <input type="checkbox" id="planImprevistosAuto" ${imprevistosAutoAdjust ? 'checked' : ''} onchange="Presupuesto._toggleImprevistosAuto()" style="margin-right:2px">Auto-reajuste
              </label>
              ${imprevistosAutoAdjust ? `<span class="sa-plan-sub" title="Según ingresos y gasto real">↻ rec. ${imprevistosRecommended.toFixed(0)}€</span>` : ''}
            </div>` : `<button class="btn btn-sm" style="border:1px solid #EC4899;background:#FDF2F8;color:#9D174D;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700" onclick="Presupuesto._enablePlanImprevistos()">Activar (${imprevistosRecommended.toFixed(0)} €/mes)</button>`}
          </div>
          <div class="sa-plan-row"><span>🎯 Ahorro (según metas)</span><strong style="color:var(--primary)">${recommendedWeeklySaving.toFixed(2)} €/sem</strong></div>
          ${plannedExpensesWeekly > 0 ? `<div class="sa-plan-row"><span>📋 Gastos planificados</span><strong style="color:#8B5CF6">${plannedExpensesWeekly.toFixed(2)} €/sem</strong></div>` : ''}
          ${imprevistosInPlan && imprevistosWeekly > 0 ? `<div class="sa-plan-row"><span>⚠️ Reserva imprevistos</span><strong style="color:#EC4899">${imprevistosWeekly.toFixed(2)} €/sem</strong></div>` : ''}
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
        ${goals.length > 0 || totalSaved > 0 ? `<div class="sa-saving-total" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px"><span>Ahorrado en metas: <strong>${totalSaved.toFixed(2)} €</strong></span><span style="color:var(--primary)">Saldo cuenta ahorro: <strong>${Store.getSavingsBalance().toFixed(2)} €</strong></span></div>` : ''}
      </div>

      ${this._renderAutonomy(allExpenses, allIncome)}

      ${this._renderPlannedExpenses(budget, limits, weekExpenses, recommendedWeeklySaving, available)}

      ${this._renderPeriodSummaries(budget, limits, weekExpenses, categories)}
      ${this._renderLearnedBudget(learnedBudget)}
      ${this._renderPriorityRecommendations()}

      ${this._renderUnifiedBudgetTracking(categoryGroups, limits, weekExpenses, categories, available)}

      ${this._renderMonthVariance()}

      <div class="sa-card sa-card-food">
        <div class="sa-food-header">
          <span>🍽️ Presupuesto mensual de Alimentación</span>
          <span class="sa-food-badge">Gasto obligatorio</span>
        </div>
        ${foodGroups.length > 1 ? `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;padding:6px 10px;background:var(--bg);border-radius:6px">
          El presupuesto total (${foodBudget.toFixed(0)} €/mes) es la suma de ${foodGroups.length} grupos de comida. Edita cada grupo en <button class="btn-sm" style="border:none;background:none;cursor:pointer;color:var(--primary);font-size:12px;padding:0" onclick="App._switchTab('categorias')">📂 Grupos de gasto</button>.
        </div>
        ${foodGroups.map(g => {
          const gSpent = BudgetEngine.getGroupMonthSpending(g.id);
          const gPct = g.monthlyBudget > 0 ? Math.min(100, (gSpent / g.monthlyBudget) * 100) : 0;
          const gColor = gPct >= 100 ? 'var(--expense)' : gPct >= 75 ? '#F59E0B' : 'var(--income)';
          return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:600">${esc(g.name)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:60px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${Math.min(100,gPct)}%;background:${gColor};border-radius:3px"></div>
              </div>
              <span style="color:${gColor};font-weight:600">${gSpent.toFixed(1)} / ${g.monthlyBudget.toFixed(0)} €</span>
            </div>
          </div>`;
        }).join('')}` : `
        <div class="sa-food-config">
          <label>Presupuesto mensual (€)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="foodBudgetInput" step="5" value="${foodBudget}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700;max-width:120px">
            <button class="btn btn-primary btn-sm" onclick="Presupuesto._saveFoodBudget()">OK</button>
          </div>
        </div>`}
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
        ${foodPct >= 100 ? '<div class="sa-food-alert">🔴 Has superado el presupuesto mensual de alimentación</div>' : foodPct >= 75 ? '<div class="sa-food-alert sa-food-alert-warn">🟡 Cuidado: ya has gastado el ' + foodPct.toFixed(0) + '% del presupuesto de alimentación</div>' : foodPct >= 50 ? '<div class="sa-food-alert sa-food-alert-ok">📊 Has gastado el ' + foodPct.toFixed(0) + '% del presupuesto de alimentación</div>' : ''}
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
          ${foodGroups.length > 0 ? `
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">📂 Grupos y categorías de alimentación:</div>
          ${foodGroups.map(g => `<div style="margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              ${g.emoji ? `<span style="font-size:16px">${g.emoji}</span>` : ''}
              <span style="font-size:12px;font-weight:700">${esc(g.name)}</span>
              <span style="font-size:10px;color:var(--text-secondary)">(${g.monthlyBudget > 0 ? g.monthlyBudget.toFixed(0) + ' €/mes' : 'sin presupuesto'})</span>
              <button class="btn-sm" style="border:none;background:none;cursor:pointer;color:var(--primary);font-size:11px;padding:0" onclick="App._switchTab('categorias')">✏️</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${g.categories.map(c => `<span class="food-cat-chip">${esc(c)}</span>`).join('')}
            </div>
          </div>`).join('')}
          ` : `
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">📂 Categorías incluidas en Alimentación:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="foodCatChips">
            ${this._renderFoodCategoryChips(categories)}
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
            <select id="foodCatAdd" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
              <option value="">+ Añadir categoría...</option>
              ${categories.filter(c => !Store.isFoodCategory(c)).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
            <button class="btn btn-primary btn-sm" onclick="Presupuesto._addFoodCategory()">+</button>
          </div>`}
          ${foodGroups.length === 0 ? '' : `<div style="margin-top:8px;font-size:11px;color:var(--text-secondary)">Para gestionar grupos y añadir categorías ve a <button class="btn-sm" style="border:none;background:none;cursor:pointer;color:var(--primary);font-size:11px;padding:0" onclick="App._switchTab('categorias')">⚙️ Ajustes → Grupos de gasto</button></div>`}
        </div>
      </div>

      ${imprevistosInPlan || imprevistosSavings > 0 ? `<div class="sa-card" style="border-left:3px solid #EC4899">
        <div class="sa-food-header">
          <span>⚠️ Reserva para imprevistos</span>
          <span class="sa-food-badge" style="background:#EC4899;color:#fff">${imprevistosInPlan && imprevistosBudget > 0 ? `${imprevistosBudget.toFixed(0)} €/mes` : imprevistosInPlan ? 'En plan' : 'Fuera del plan'}</span>
        </div>
        ${imprevistosInPlan ? `<div class="sa-food-config">
          <label>Reserva mensual (€)${imprevistosAutoAdjust ? ' · se reajusta solo según ingresos y gasto' : ''}</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="number" id="imprevistosBudgetInput" step="5" value="${imprevistosBudget}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700;max-width:120px">
            <button class="btn btn-primary btn-sm" onclick="Presupuesto._saveImprevistosBudget()">OK</button>
            ${imprevistosAutoAdjust ? `<span style="font-size:11px;color:var(--text-secondary)">Recomendado: ${imprevistosRecommended.toFixed(0)} €/mes</span>` : ''}
          </div>
        </div>
        ${imprevistosBudget > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
            <span>Gastado: <strong style="color:${imprevistosSpent > 0 ? 'var(--expense)' : 'var(--text)'}">${imprevistosSpent.toFixed(2)} €</strong></span>
            <span>Disponible: <strong style="color:${imprevistosRemaining > 0 ? 'var(--income)' : 'var(--text-secondary)'}">${imprevistosRemaining.toFixed(2)} €</strong></span>
            <span>${imprevistosWeekly.toFixed(2)} €/sem reservados</span>
          </div>
        </div>
        <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${Math.min(100, (imprevistosSpent / imprevistosBudget) * 100)}%;background:#EC4899;border-radius:4px"></div></div>
        ${imprevistosSpent >= imprevistosBudget ? '<div style="margin-top:6px;padding:6px 10px;background:#FDF2F8;border-radius:6px;font-size:12px;color:#9D174D">🔴 Has agotado la reserva de imprevistos. Revisa si puedes aumentarla.</div>' : imprevistosBudget - imprevistosSpent > 0 ? '<div style="margin-top:6px;padding:6px 10px;background:#F0FDF4;border-radius:6px;font-size:12px;color:#166534">✅ Reserva disponible. Si no la usas, revisa al cerrar mes para pasar el sobrante a ahorro.</div>' : ''}
        ` : '<p style="font-size:13px;color:var(--text-secondary);padding:4px 0">Activa la reserva en el plan inteligente arriba.</p>'}` : `<p style="font-size:13px;color:var(--text-secondary);padding:8px 0">Desactivado en el plan. Puedes reactivarlo arriba o desde la guía de ahorro.</p>`}
        ${imprevistosSavings > 0 ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <span style="font-size:13px;font-weight:600">🐷 Ahorro acumulado de imprevistos: <strong style="color:var(--primary)">${imprevistosSavings.toFixed(2)} €</strong></span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${imprevistosInPlan && imprevistosBudget > 0 && imprevistosRemaining > 0 ? `<button class="btn btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:6px;cursor:pointer;font-size:11px" onclick="Presupuesto._accumulateImprevistos()">📥 Acumular remanente (${imprevistosRemaining.toFixed(2)} €)</button>` : ''}
              <button class="btn btn-sm btn-primary" style="border-radius:6px;font-size:11px" onclick="Presupuesto._transferImprevistosSavings()">💰 Pasar a ahorro</button>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Ahorro acumulado de meses anteriores. Puedes transferirlo a tus metas cuando quieras.</div>
        </div>` : ''}
      </div>` : ''}

      ${this._renderDebts()}
      ${this._renderRecurring()}
      ${this._render503020(budget, monthIncome, monthExpenses)}

      ${this._renderOptimizer(weekExpenses, limits, budget, recommendedWeeklySaving, goals)}

      <div class="sa-card sa-card-tip">
        <div class="card-header"><span class="card-title">💡 Consejos inteligentes</span></div>
        <div id="adviceContent">${this._renderAdvice(budget, limits, weekExpenses, goals, foodBudget, foodSpent, foodPct, recommendedWeeklySaving)}</div>
      </div>
    `;
    this._applyAccordion(el);
    document.getElementById('newLimitAmount').addEventListener('input', () => this._checkNewLimit());
    document.getElementById('newLimitCategory').addEventListener('change', () => this._checkNewLimit());
    document.getElementById('peAmount')?.addEventListener('input', () => this._pePreview());
    document.getElementById('peDate')?.addEventListener('change', () => this._pePreview());
  },

  /** Wraps each top-level card/sa-card in the tab into a collapsible accordion section. */
  _applyAccordion(container) {
    const sectionMeta = [
      { selector: '.sa-card-plan', id: 'plan', title: '🧠 Plan financiero', defaultOpen: true },
      { selector: '.sa-card-saving', id: 'goals', title: '🎯 Metas de ahorro', defaultOpen: true },
      { selector: '.card:has(#unifiedBudgetList)', id: 'limits', title: '📊 Presupuesto y seguimiento', defaultOpen: true },
      { selector: '.sa-card-period-summaries', id: 'weeksummary', title: '📊 Resúmenes semanal y mensual', defaultOpen: true },
      { selector: '.sa-card-priority-recs', id: 'priorityrecs', title: '🎯 Recomendaciones por prioridad', defaultOpen: true },
      { selector: '.sa-card-monthvariance', id: 'monthvariance', title: '📅 Seguimiento mensual', defaultOpen: true },
      { selector: '.sa-card-food', id: 'food', title: '🍽️ Presupuesto alimentación', defaultOpen: false },
      { selector: '.sa-card:has(#imprevistosBudgetInput)', id: 'imprevistos', title: '⚠️ Fondo de imprevistos', defaultOpen: false },
      { selector: '.sa-card-autonomy', id: 'autonomy', title: '🏦 Autonomía financiera', defaultOpen: false },
      { selector: '.sa-card-plan-gastos', id: 'plangastos', title: '📋 Gastos planificados', defaultOpen: false },
      { selector: '.sa-card-debts', id: 'debts', title: '💳 Deudas pendientes', defaultOpen: false },
      { selector: '.sa-card-recurring', id: 'recurring', title: '🔁 Movimientos recurrentes', defaultOpen: false },
      { selector: '.sa-card-learned-budget', id: 'learned', title: '📈 Presupuesto sugerido', defaultOpen: true },
      { selector: '.sa-card-optimizer', id: 'optimizer', title: '🔧 Optimizador', defaultOpen: false },
      { selector: '.sa-card-tip', id: 'tips', title: '💡 Consejos', defaultOpen: false },
    ];
    // For cards without a specific class, just add a generic accordion
    for (const meta of sectionMeta) {
      let card = null;
      try { card = container.querySelector(meta.selector); } catch {}
      if (!card) continue;
      const open = this._openSections.has(meta.id) ?? meta.defaultOpen;
      if (meta.defaultOpen && !this._openSections.has(meta.id + '_init')) {
        this._openSections.add(meta.id);
        this._openSections.add(meta.id + '_init');
      }
      const isOpen = this._openSections.has(meta.id);
      card.classList.add('pres-accordeon-card');
      const header = card.querySelector('.card-header');
      if (!header) continue;
      header.classList.add('pres-acc-header');
      header.setAttribute('data-section', meta.id);
      const chevron = document.createElement('span');
      chevron.className = 'pres-section-chevron';
      chevron.textContent = isOpen ? '▲' : '▼';
      header.appendChild(chevron);
      const body = Array.from(card.children).filter(c => c !== header);
      const bodyWrap = document.createElement('div');
      bodyWrap.className = 'pres-section-body';
      bodyWrap.style.display = isOpen ? '' : 'none';
      body.forEach(n => bodyWrap.appendChild(n));
      card.appendChild(bodyWrap);
      header.style.cursor = 'pointer';
      header.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select')) return;
        const sid = header.dataset.section;
        const isNowOpen = this._openSections.has(sid);
        if (isNowOpen) this._openSections.delete(sid);
        else this._openSections.add(sid);
        bodyWrap.style.display = isNowOpen ? 'none' : '';
        chevron.textContent = isNowOpen ? '▼' : '▲';
      });
    }
  },

  _getMonthFoodSpending() {
    return BudgetEngine.getMonthFoodSpending();
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
    const b = BudgetEngine.calcWeekly();
    const ungroupedLimits = Store.getUngroupedCategoryLimits();
    const totalOther = Object.entries(ungroupedLimits).filter(([c]) => c !== cat).reduce((s, [, v]) => s + v, 0);
    const groupsWeekly = Store.getTrackingBudgetWeeklyTotal() - Object.values(ungroupedLimits).reduce((s, v) => s + v, 0);
    const available = b.discretionaryBudget;
    const projectedTotal = totalOther + groupsWeekly + amt;
    const exceeds = projectedTotal > Math.max(0, available);
    el.style.display = 'block';
    if (exceeds) {
      el.style.background = 'var(--expense-bg)';
      el.style.color = 'var(--expense)';
      el.textContent = `🔴 El seguimiento total (${projectedTotal.toFixed(0)} €/sem) supera el disponible (${Math.max(0, available).toFixed(0)} €/sem)`;
      return;
    }
    const alert = this.getAlertLevel(cat, amt);
    if (!alert) { el.style.display = 'none'; return; }
    const { alreadySpent, projectedTotal: catProjected, limit, level } = alert;
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
    el.textContent = `${labels[level]} — ${alreadySpent.toFixed(2)} € + ${amt.toFixed(2)} € = ${catProjected.toFixed(2)} € / ${limit.toFixed(2)} €`;
  },

  _renderUnifiedBudgetTracking(categoryGroups, limits, weekExpenses, categories, available) {
    const ungroupedLimits = Store.getUngroupedCategoryLimits();
    const nonFoodGroups = categoryGroups.filter(g => !g.isFoodGroup);
    const groupsWithBudget = nonFoodGroups.filter(g => g.monthlyBudget > 0);
    const groupsTracking = nonFoodGroups.filter(g => g.monthlyBudget <= 0 && g.categories.length > 0);
    const totalTrackingWeekly = Store.getTrackingBudgetWeeklyTotal();
    const exceeds = totalTrackingWeekly > Math.max(0, available);

    const groupRows = [...groupsWithBudget, ...groupsTracking].map(g => {
      const monthSpent = BudgetEngine.getGroupMonthSpending(g.id);
      const weekSpent = BudgetEngine.getGroupWeekSpending(g.id);
      const weeklyBudget = g.monthlyBudget > 0 ? g.monthlyBudget / 4.33 : 0;
      const weekPct = weeklyBudget > 0 ? Math.min(100, (weekSpent / weeklyBudget) * 100) : 0;
      const monthPct = g.monthlyBudget > 0 ? Math.min(100, (monthSpent / g.monthlyBudget) * 100) : 0;
      const color = (g.monthlyBudget > 0 ? monthPct : weekPct) >= 100 ? 'var(--expense)' : (g.monthlyBudget > 0 ? monthPct : weekPct) >= 80 ? '#F97316' : 'var(--income)';
      const groupEmoji = g.emoji ? `${g.emoji} ` : '';
      return `<div class="ub-item" style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:700;font-size:14px">${groupEmoji}${esc(g.name)} <span style="font-size:10px;color:var(--primary);font-weight:600">grupo · mensual</span></span>
          <span style="font-size:12px;color:${color};font-weight:600">${g.monthlyBudget > 0 ? `${monthSpent.toFixed(0)} / ${g.monthlyBudget.toFixed(0)} € mes` : `${monthSpent.toFixed(0)} € mes`}</span>
        </div>
        ${g.monthlyBudget > 0 ? `<div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${monthPct}%;background:${color};border-radius:4px"></div></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:3px">
          <span>Semana: ${weekSpent.toFixed(1)}€${weeklyBudget > 0 ? ` / ${weeklyBudget.toFixed(0)}€` : ''}</span>
          ${g.monthlyBudget > 0 ? `<span style="color:${monthSpent <= g.monthlyBudget ? 'var(--income)' : 'var(--expense)'}">${(g.monthlyBudget - monthSpent).toFixed(0)}€ restan este mes</span>` : '<span>Solo seguimiento</span>'}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${g.categories.map(c => `<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);padding:1px 6px;border-radius:8px">${esc(c)}</span>`).join('')}
        </div>
      </div>`;
    }).join('');

    const ungroupedCats = categories.filter(c => !Store.getCategoryGroup(c) && !Store.isFoodCategory(c));
    const limitRows = this._renderCategoryLimits(ungroupedCats, ungroupedLimits, weekExpenses);

    return `<div class="card" style="border-left:3px solid #6366F1">
      <div class="card-header">
        <span class="card-title">📊 Presupuesto y seguimiento</span>
        <button class="btn btn-secondary btn-sm" onclick="App._switchTab('categorias')">Gestionar grupos</button>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
        Sistema unificado: cada categoría va en un <strong>grupo con presupuesto mensual</strong> o con <strong>límite semanal propio</strong> — nunca ambos.
        La alimentación se gestiona aparte arriba.
      </p>
      ${totalTrackingWeekly > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:8px">
        <span>📊 Seguimiento: <strong>${totalTrackingWeekly.toFixed(0)} €/sem</strong></span>
        <span>💸 Disponible plan: <strong style="color:var(--primary)">${Math.max(0, available).toFixed(2)} €/sem</strong></span>
        <span style="color:${exceeds ? 'var(--expense)' : 'var(--income)'}">${exceeds ? `🔴 Excede en ${(totalTrackingWeekly - available).toFixed(0)}€` : '✅ En plan'}</span>
      </div>` : ''}
      <div id="unifiedBudgetList">
        ${groupRows || ''}
        ${groupRows ? '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin:10px 0 6px">🏷️ Categorías sueltas (límite semanal)</div>' : ''}
        <div id="categoryLimitsList">${limitRows}</div>
      </div>
      <div class="add-cat-form" style="margin-top:10px">
        <select id="newLimitCategory" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          ${ungroupedCats.filter(c => !ungroupedLimits[c]).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <input type="number" id="newLimitAmount" placeholder="€/sem" step="1" style="width:70px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        <button class="btn btn-primary" onclick="Presupuesto._addLimit()">+</button>
      </div>
      <div id="budgetLimitHint" style="display:none;margin-top:6px;padding:6px 8px;border-radius:4px;font-size:12px;text-align:center;font-weight:600"></div>
    </div>`;
  },

  _renderCategoryLimits(categories, limits, weekExpenses) {
    const cats = categories.filter(c => limits[c] !== undefined && limits[c] > 0);
    if (cats.length === 0) return '<p style="color:var(--text-secondary);font-size:14px;text-align:center;padding:8px">Añade límites a las categorías que más gastas</p>';
    return cats.map(cat => {
      const limit = limits[cat];
      const spent = weekExpenses.filter(t => Store._categoryKeysMatch(t.category, cat)).reduce((s, t) => s + t.amount, 0);
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const remain = limit - spent;
      const level = this._alertLevel(spent, limit);
      const barColor = { good: 'var(--income)', caution: '#F59E0B', warning: '#F97316', danger: 'var(--expense)' }[level];
      const safecat = esc(cat);
      return `<div class="budget-cat-item" data-cat="${safecat}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;font-size:14px">${safecat}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px"><strong style="color:${spent <= limit ? 'var(--text)' : 'var(--expense)'}">${spent.toFixed(1)}</strong><span style="color:var(--text-secondary)"> / ${limit.toFixed(0)} €</span></span>
            <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer;font-size:11px;padding:2px 6px" title="Editar límite" onclick="Presupuesto._editLimit('${safecat}')">✏️</button>
            <button class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer;font-size:11px;padding:2px 6px" title="Eliminar límite" onclick="Presupuesto._removeLimit('${safecat}')">✕</button>
          </div>
        </div>
        <div class="progress-bar" style="height:10px"><div class="progress-fill" style="width:${pct}%;background:${barColor};border-radius:5px"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-top:2px">
          <span>${pct.toFixed(0)}% gastado esta semana</span>
          <span>${remain >= 0 ? `Restan ${remain.toFixed(1)} €` : `<strong style="color:var(--expense)">${(spent - limit).toFixed(1)} € excedido</strong>`}</span>
        </div>
      </div>`;
    }).join('');
  },

  _render503020(budget, monthIncome, monthExpenses) {
    const totalIncome = monthIncome.reduce((s, t) => s + t.amount, 0);
    const monthly = Math.max(totalIncome || budget.totalWeekly * 4.33, budget.totalWeekly * 4.33);
    const skipCats = ['Ahorro','Ahorro programado'];
    const needs = monthExpenses.filter(t => Store.isFoodCategory(t.category) || ['Vivienda', 'Transporte', 'Salud', 'Educación'].some(c => Store._categoryKeysMatch(c, t.category))).reduce((s, t) => s + t.amount, 0);
    const wants = monthExpenses.filter(t => !Store.isFoodCategory(t.category) && !['Vivienda', 'Transporte', 'Salud', 'Educación'].some(c => Store._categoryKeysMatch(c, t.category)) && !skipCats.includes(t.category)).reduce((s, t) => s + t.amount, 0);
    // Use savings account balance (matches Dashboard "Ahorro real")
    const savings = Store.getSavingsBalance();
    const pctNeeds = monthly > 0 ? (needs / monthly) * 100 : 0;
    const pctWants = monthly > 0 ? (wants / monthly) * 100 : 0;
    const pctSavings = monthly > 0 ? (savings / monthly) * 100 : 0;
    return `<div class="card">
      <div class="card-header"><span class="card-title">📐 Regla 50/30/20</span><span style="font-size:11px;color:var(--text-secondary)">Mes actual · Ingresos: ${monthly.toFixed(0)} €</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${this._ruleBar('Necesidades (Comida, Vivienda...)','#10B981',pctNeeds,50,needs)}
        ${this._ruleBar('Deseos','#F59E0B',pctWants,30,wants)}
      </div>
      ${this._ruleBar('Ahorro (saldo cuenta)','#4F46E5',pctSavings,20,savings)}
    </div>`;
  },

  _ruleBar(label, color, actual, target, amount) {
    const income = Math.max(App.getCurrentTransactions().filter(t=>t.type==='Ingreso').reduce((s,t)=>s+t.amount,0), 1);
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
        <select id="recType" class="rec-input" onchange="Presupuesto._syncRecCategory()"><option value="Gasto">Gasto</option><option value="Ingreso">Ingreso</option></select>
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

  _syncRecCategory() {
    const type = document.getElementById('recType')?.value || 'Gasto';
    const sel = document.getElementById('recCategory');
    if (!sel) return;
    const cats = Store.getCategoriesForType(type);
    const current = sel.value;
    const defaultCat = type === 'Ingreso'
      ? (cats.includes('Mensualidad') ? 'Mensualidad' : cats[0])
      : (cats.includes('Comida') ? 'Comida' : cats[0]);
    const pick = cats.includes(current) ? current : defaultCat;
    sel.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === pick ? 'selected' : ''}>${esc(c)}</option>`).join('');
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


  _renderPlannedExpenses(budget, limits, weekExpenses, recommendedWeeklySaving, available) {
    const expenses = Store.getPlannedExpenses();

    return `<div class="sa-card sa-card-plan-gastos">
      <div class="card-header">
        <span class="card-title">📋 Gastos planificados</span>
        <span style="font-size:11px;color:var(--text-secondary)">Ahorra sin esfuerzo</span>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Planifica un gasto futuro y la app reservará automáticamente de tus ingresos semanales para cubrirlo.</p>
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
        const saved = p.savedSoFar || 0;
        const weeklyNeed = Math.max(0, (p.amount - saved) / weeksLeft);
        const pct = p.amount > 0 ? Math.min(100, (saved / p.amount) * 100) : 0;
        const isPaid = saved >= p.amount;
        const gcalDate = p.targetDate ? p.targetDate.replace(/-/g, '') : '';
        const gcalUrl = gcalDate ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(p.name)}&dates=${gcalDate}/${gcalDate}&details=${encodeURIComponent('Gasto planificado: ' + p.amount + ' €')}&sf=true&output=xml` : '';
        const dateLabel = p.targetDate ? new Date(p.targetDate + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
        return `<div style="padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;${isPaid ? 'opacity:0.7' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:700;font-size:14px">${esc(p.name)} · <span style="color:var(--primary)">${p.amount.toFixed(0)} €</span></span>
            <div style="display:flex;gap:4px;align-items:center">
              ${dateLabel ? `<span style="font-size:11px;color:var(--text-secondary)">📅 ${dateLabel}</span>` : ''}
              ${gcalUrl ? `<a href="${gcalUrl}" target="_blank" class="btn-sm" style="border:1px solid var(--border);background:var(--card);border-radius:4px;cursor:pointer;text-decoration:none;font-size:11px;padding:2px 6px" title="Añadir a Google Calendar">📆</a>` : ''}
              <button class="btn-sm" style="border:none;background:none;cursor:pointer;color:var(--text-secondary)" onclick="Presupuesto._deletePlannedExpense('${p.id}')">✕</button>
            </div>
          </div>
          ${isPaid
            ? '<div style="color:var(--income);font-size:12px;font-weight:700">🎉 ¡Gasto cubierto! Listo para pagar.</div>'
            : `<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin-bottom:4px">
              <span>🎯 Faltan <strong>${(p.amount - saved).toFixed(0)} €</strong></span>
              <span>💰 Reservando <strong>${weeklyNeed.toFixed(2)} €/sem</strong></span>
              <span style="color:var(--text-secondary)">${Math.ceil(weeksLeft)} sem. restantes</span>
            </div>`}
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar" style="flex:1;height:6px"><div class="progress-fill" style="width:${pct}%;background:${isPaid ? 'var(--income)' : 'var(--primary)'};border-radius:3px"></div></div>
            <span style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${saved.toFixed(1)}€ / ${p.amount.toFixed(0)}€ (${pct.toFixed(0)}%)</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  _renderPeriodSummaries(budget, limits, weekExpenses, categories) {
    const week = BudgetEngine.getPeriodSummary('week');
    const month = BudgetEngine.getPeriodSummary('month');

    const renderBreakdown = (sum, isWeek) => {
      const groupRows = sum.byGroup.slice(0, 8).map(g => {
        const meta = BudgetEngine.getPriorityMeta(g.priority);
        const color = g.pct >= 100 ? 'var(--expense)' : g.pct >= 80 ? '#F97316' : 'var(--income)';
        return `<div class="psum-row">
          <div class="psum-row-top">
            <span>${g.emoji} ${esc(g.name)}${g.isFoodGroup ? ' <span style="font-size:10px;background:#FEF3C7;color:#92400E;padding:1px 5px;border-radius:8px">🍽️</span>' : ''} <span class="prio-mini" style="background:${meta.color}">${meta.short}</span></span>
            <span style="color:${color};font-weight:700">${g.spent.toFixed(0)}€${g.budget > 0 ? ` / ${g.budget.toFixed(0)}€` : ''}</span>
          </div>
          ${g.budget > 0 ? `<div class="psum-bar"><div style="width:${Math.min(100, g.pct)}%;background:${color}"></div></div>` : ''}
        </div>`;
      }).join('');

      const ungrouped = (sum.ungroupedExpenses || []).slice(0, 6);
      const ungroupedRows = ungrouped.map(c => {
        const meta = BudgetEngine.getPriorityMeta(c.priority);
        const emoji = Store.getCatalogDisplayEmoji('category', c.name);
        return `<div class="psum-row">
          <div class="psum-row-top">
            <span>${emoji} ${esc(c.name)}${c.isFood ? ' <span style="font-size:10px;color:#92400E">🍽️</span>' : ''} <span class="prio-mini" style="background:${meta.color}">${meta.short}</span></span>
            <span style="font-weight:700">${c.spent.toFixed(0)}€${c.budget > 0 ? ` / ${c.budget.toFixed(0)}€` : ''}</span>
          </div>
        </div>`;
      }).join('');

      const incomeRows = (sum.byIncomeGroup || []).filter(g => g.received > 0).slice(0, 5).map(g => `
        <div class="psum-row">
          <div class="psum-row-top">
            <span>${g.emoji} ${esc(g.name)} <span style="font-size:10px;background:#ECFDF5;color:#065F46;padding:1px 5px;border-radius:8px">💰</span></span>
            <span style="color:var(--income);font-weight:700">+${g.received.toFixed(0)}€${g.target > 0 ? ` / ${g.target.toFixed(0)}€` : ''}</span>
          </div>
        </div>`).join('');

      const fallbackRows = !groupRows && !ungroupedRows
        ? sum.topExpenses.map(c => {
          const meta = BudgetEngine.getPriorityMeta(c.priority);
          const emoji = Store.getCatalogDisplayEmoji('category', c.name);
          return `<div class="psum-row">
            <div class="psum-row-top">
              <span>${emoji} ${esc(c.name)} <span class="prio-mini" style="background:${meta.color}">${meta.short}</span></span>
              <span style="font-weight:700">${c.spent.toFixed(0)}€</span>
            </div>
          </div>`;
        }).join('')
        : '';

      const expenseRows = groupRows
        + (ungroupedRows ? `<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin:8px 0 4px">Sin grupo asignado</div>${ungroupedRows}` : '')
        + fallbackRows;

      return `
        <div class="psum-stats">
          <div class="week-stat"><div class="week-stat-label">Ingresado</div><div class="week-stat-value income">${sum.incomeActual.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Gastado</div><div class="week-stat-value expense">${sum.expenseTotal.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Balance</div><div class="week-stat-value" style="color:${sum.balanceActual >= 0 ? 'var(--income)' : 'var(--expense)'}">${sum.balanceActual >= 0 ? '+' : ''}${sum.balanceActual.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Plan ingreso</div><div class="week-stat-value" style="color:var(--primary)">${sum.incomeConfigured.toFixed(0)} €</div></div>
        </div>
        ${isWeek ? `
        <div class="psum-stats" style="margin-top:6px">
          <div class="week-stat"><div class="week-stat-label">Disponible</div><div class="week-stat-value" style="color:var(--primary)">${budget.discretionaryBudget.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Restante</div><div class="week-stat-value" style="color:${budget.discretionaryRemaining >= 0 ? 'var(--income)' : 'var(--expense)'}">${budget.discretionaryRemaining.toFixed(0)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Por día</div><div class="week-stat-value" style="color:var(--primary)">${budget.dailySpendable.toFixed(1)} €</div></div>
          <div class="week-stat"><div class="week-stat-label">Días</div><div class="week-stat-value">${budget.daysLeft}</div></div>
        </div>` : ''}
        <div style="margin-top:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">Desglose por prioridad (gastos)</div>
          ${expenseRows || '<div style="font-size:12px;color:var(--text-secondary)">Sin gastos en este periodo</div>'}
        </div>
        ${incomeRows ? `<div style="margin-top:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">Ingresos por grupo</div>
          ${incomeRows}
        </div>` : ''}
      `;
    };

    const limitRemain = Object.keys(Store.getUngroupedCategoryLimits()).length > 0 ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">🏷️ Categorías sueltas (semana):</div>
        ${Object.entries(Store.getUngroupedCategoryLimits()).map(([cat, limit]) => {
          const spent = weekExpenses.filter(t => Store._categoryKeysMatch(t.category, cat)).reduce((s, t) => s + t.amount, 0);
          const remain = limit - spent;
          const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
          const color = pct >= 100 ? 'var(--expense)' : pct >= 80 ? '#F97316' : pct >= 50 ? '#F59E0B' : 'var(--income)';
          return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0">
            <span style="font-weight:500">${esc(cat)}</span>
            <span style="color:${color};font-weight:600">${remain >= 0 ? `${remain.toFixed(1)} €` : `-${Math.abs(remain).toFixed(1)} €`}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    return `<div class="sa-card sa-card-period-summaries">
      <div class="card-header">
        <span class="card-title">📊 Resúmenes semanal y mensual</span>
      </div>
      <div class="psum-tabs">
        <button type="button" class="psum-tab active" data-psum="week" onclick="Presupuesto._switchPsum(this,'week')">Semana · ${esc(week.label)}</button>
        <button type="button" class="psum-tab" data-psum="month" onclick="Presupuesto._switchPsum(this,'month')">Mes · ${esc(month.label)}</button>
      </div>
      <div id="psum-week" class="psum-panel">${renderBreakdown(week, true)}${limitRemain}
        ${budget.discretionaryRemaining <= 0 ? '<div style="margin-top:8px;padding:8px 12px;background:var(--expense-bg);color:var(--expense);border-radius:8px;font-weight:600;font-size:13px">🔴 Has superado el presupuesto discrecional semanal</div>' : ''}
      </div>
      <div id="psum-month" class="psum-panel" style="display:none">${renderBreakdown(month, false)}
        <div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">Proyección fin de mes (ritmo actual): <strong>${BudgetEngine.getMonthVariance().projectedMonthTotal.toFixed(0)} €</strong></div>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--text-secondary)">
        Prioridades en <button type="button" class="linkish" onclick="App._switchTab('categorias')">⚙️ Configuración → Prioridad de gastos</button>
      </div>
    </div>`;
  },

  _switchPsum(btn, which) {
    const card = btn.closest('.sa-card-period-summaries');
    if (!card) return;
    card.querySelectorAll('.psum-tab').forEach(t => t.classList.toggle('active', t === btn));
    const week = card.querySelector('#psum-week');
    const month = card.querySelector('#psum-month');
    if (week) week.style.display = which === 'week' ? '' : 'none';
    if (month) month.style.display = which === 'month' ? '' : 'none';
  },

  _renderLearnedBudget(learned) {
    if (!learned) learned = BudgetEngine.getLearnedBudgetSuggestions();
    const { stats, income, global, suggestions, confidence } = learned;
    const confLabel = { high: 'Alta confianza', medium: 'Confianza media', low: 'Pocos datos', none: 'Sin datos' }[confidence] || '';
    const confColor = confidence === 'high' ? 'var(--income)' : confidence === 'medium' ? '#F59E0B' : 'var(--text-secondary)';
    const hasData = stats.numMonths > 0 && (stats.avgMonthlyExpense > 0 || stats.avgMonthlyIncome > 0);

    if (!hasData && !income.hasManual) {
      return `<div class="sa-card sa-card-learned-budget">
        <div class="card-header"><span class="card-title">📈 Presupuesto sugerido</span></div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.55">
          Empieza registrando gastos e ingresos — no hace falta configurar nada antes.
          Con cada movimiento la app aprenderá tu ritmo y te propondrá presupuestos semanales y mensuales por grupo.
        </p>
        <button class="btn btn-secondary btn-sm" onclick="App._switchTab('categorias')">Configurar ingresos (opcional) →</button>
      </div>`;
    }

    return `<div class="sa-card sa-card-learned-budget">
      <div class="card-header">
        <span class="card-title">📈 Presupuesto sugerido</span>
        <span style="font-size:11px;font-weight:600;color:${confColor}">${confLabel}${stats.numMonths ? ` · ${stats.numMonths} mes${stats.numMonths !== 1 ? 'es' : ''}` : ''}</span>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
        Basado en tu historial de movimientos${income.hasManual ? ' y en modo híbrido con tus ingresos configurados' : ''}.
        ${esc(income.sourceLabel)}.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:700">Ingreso estimado</div>
          <div style="font-size:18px;font-weight:800;color:var(--income)">${income.monthly.toFixed(0)} €/mes</div>
          <div style="font-size:11px;color:var(--text-secondary)">${income.weekly.toFixed(1)} €/sem</div>
        </div>
        <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--text-secondary);text-transform:uppercase;font-weight:700">Gasto habitual</div>
          <div style="font-size:18px;font-weight:800;color:var(--expense)">${stats.avgMonthlyExpense.toFixed(0)} €/mes</div>
          <div style="font-size:11px;color:var(--text-secondary)">${stats.avgWeeklyExpense.toFixed(1)} €/sem</div>
        </div>
      </div>
      ${global.suggestedMonthly > 0 ? `<div style="padding:10px;background:linear-gradient(135deg,var(--primary-light),var(--card));border-radius:8px;margin-bottom:12px;font-size:12px;line-height:1.5">
        <strong>Presupuesto global sugerido:</strong> ${global.suggestedWeekly.toFixed(1)} €/sem · ${global.suggestedMonthly.toFixed(0)} €/mes
      </div>` : ''}
      ${suggestions.length > 0 ? `
      <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase">Por grupo y categoría</div>
      <div class="sa-opt-list">
        ${suggestions.slice(0, 6).map(r => `<div class="sa-opt-item sa-opt-good">
          <div class="sa-opt-item-hdr">
            <span class="sa-opt-cat">${r.emoji || ''} ${esc(r.targetName)}</span>
            <span class="sa-opt-spend">${r.type === 'setup' ? '✨ Sugerido' : '↔ Ajustar'}</span>
          </div>
          <div class="sa-opt-msg">${esc(r.reason)}</div>
          <div style="margin-top:6px;font-size:12px;font-weight:600">
            ${r.currentWeekly > 0 ? `${r.currentWeekly.toFixed(1)}€/sem → ` : ''}<strong>${r.suggestedWeekly.toFixed(1)}€/sem</strong>
            · ${r.currentMonthly > 0 ? `${r.currentMonthly.toFixed(0)}€/mes → ` : ''}<strong>${r.suggestedMonthly.toFixed(0)}€/mes</strong>
          </div>
          <button class="btn-sm" style="margin-top:8px;background:var(--primary);color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:700"
            onclick="Presupuesto._applyPriorityRec('${r.id}')">Aplicar sugerencia</button>
        </div>`).join('')}
      </div>` : `<p style="font-size:12px;color:var(--text-secondary)">Tus presupuestos por grupo ya están alineados con el historial. Sigue registrando movimientos para afinar las recomendaciones.</p>`}
      <div style="margin-top:10px">
        <button type="button" class="linkish" style="font-size:12px" onclick="App._switchTab('categorias')">⚙️ Configurar ingresos manualmente →</button>
      </div>
    </div>`;
  },

  _renderPriorityRecommendations() {
    const pack = BudgetEngine.getBudgetRecommendations();
    const recs = pack.recommendations;
    if (!recs.length) {
      return `<div class="sa-card sa-card-priority-recs">
        <div class="card-header"><span class="card-title">🎯 Recomendaciones por prioridad</span></div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.5">
          No hay ajustes urgentes. Cuando el gasto se desvíe del plan, aquí verás variaciones semanales y mensuales de alimentación, salidas, grupos y límites según tus prioridades.
        </p>
        <button class="btn btn-secondary btn-sm" onclick="App._switchTab('categorias')">Ajustar prioridades →</button>
      </div>`;
    }

    const levelBg = { danger: 'sa-opt-danger', warn: 'sa-opt-warn', info: 'sa-opt-good', good: 'sa-opt-good' };
    return `<div class="sa-card sa-card-priority-recs">
      <div class="card-header">
        <span class="card-title">🎯 Recomendaciones por prioridad</span>
        <span style="font-size:11px;color:var(--text-secondary)">${recs.length} sugerencia${recs.length !== 1 ? 's' : ''}</span>
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
        Basado en tu gasto real y en las prioridades de <strong>⚙️ Configuración</strong>. Puedes aplicar cada variación al presupuesto semanal/mensual.
      </p>
      <div class="sa-opt-list">
        ${recs.map(r => {
          const meta = BudgetEngine.getPriorityMeta(r.priority);
          const canApply = r.target !== 'plan' || r.applyAllLowPriority;
          return `<div class="sa-opt-item ${levelBg[r.level] || 'sa-opt-warn'}">
            <div class="sa-opt-item-hdr">
              <span class="sa-opt-cat">${r.emoji || ''} ${esc(r.targetName)} <span class="prio-mini" style="background:${meta.color}">${meta.short}</span></span>
              <span class="sa-opt-spend">${r.type === 'increase' ? '⬆️ Subir' : r.type === 'decrease' ? '⬇️ Bajar' : r.type === 'setup' ? '✨ Sugerido' : r.type === 'adjust' ? '↔ Ajustar' : '⚖️ Reequilibrar'}</span>
            </div>
            <div class="sa-opt-msg">${esc(r.reason)}</div>
            <div style="margin-top:6px;font-size:12px;font-weight:600">
              ${r.currentWeekly.toFixed(1)}€/sem → <strong>${r.suggestedWeekly.toFixed(1)}€/sem</strong>
              · ${r.currentMonthly.toFixed(0)}€/mes → <strong>${r.suggestedMonthly.toFixed(0)}€/mes</strong>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${esc(r.impact)}</div>
            ${canApply ? `<button class="btn-sm" style="margin-top:8px;background:var(--primary);color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:700"
              onclick="Presupuesto._applyPriorityRec('${r.id}')">${r.applyAllLowPriority ? 'Aplicar recortes P4–P5' : 'Aplicar variación'}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _applyPriorityRec(recId) {
    const pack = BudgetEngine.getBudgetRecommendations();
    const rec = pack.recommendations.find(r => r.id === recId)
      || pack.learned?.suggestions?.find(r => r.id === recId);
    if (!rec) { App.showToast('Recomendación no disponible'); return; }
    const ok = BudgetEngine.applyRecommendation(rec);
    if (ok) {
      App.showToast(`✅ Presupuesto actualizado: ${rec.targetName}`);
      this.render();
      Dashboard.render?.();
    } else {
      App.showToast('No se pudo aplicar esta recomendación');
    }
  },

  _renderAdvice(budget, limits, weekExpenses, goals, foodBudget, foodSpent, foodPct, recommendedWeeklySaving) {
    const tips = [];
    const b = BudgetEngine.calcWeekly();
    const { daysLeft, discretionaryBudget, weekDiscSpent, discretionaryRemaining } = b;
    if (daysLeft > 0 && discretionaryBudget > 0) {
      const spentPct = (weekDiscSpent / discretionaryBudget) * 100;
      const pctWeek = ((7 - daysLeft) / 7) * 100;
      const pace = spentPct - pctWeek;
      if (pace > 15) tips.push(`🔴 Gastaste ${spentPct.toFixed(0)}% del disponible discrecional pero sólo pasó el ${pctWeek.toFixed(0)}% de la semana. Reduce el ritmo.`);
      else if (pace < -10) tips.push(`✅ Buen ritmo: ${spentPct.toFixed(0)}% del disponible gastado en ${pctWeek.toFixed(0)}% de la semana.`);
      else tips.push(`📊 Vas bien encaminado. Quedan ${discretionaryRemaining.toFixed(2)} € discrecionales para ${daysLeft} días.`);
    }
    if (foodBudget > 0) {
      if (foodPct >= 100) tips.push(`🍽️ Has superado el presupuesto de alimentación (${foodSpent.toFixed(0)}€ de ${foodBudget.toFixed(0)}€). Revisa tus gastos.`);
      else if (foodPct >= 75) tips.push(`🍽️ Cuidado con la alimentación: ${foodPct.toFixed(0)}% del presupuesto gastado. Quedan ${(foodBudget - foodSpent).toFixed(0)}€ para el mes.`);
      else tips.push(`🍽️ Gastos de alimentación controlados: ${foodSpent.toFixed(0)}€ de ${foodBudget.toFixed(0)}€ (${foodPct.toFixed(0)}%).`);
    }
    Object.entries(limits).filter(([cat,limit])=>{
      const s = weekExpenses.filter(t=>t.category===cat).reduce((a,t)=>a+t.amount,0);
      return s > limit * 0.8;
    }).forEach(([cat,limit])=>{
      const s = weekExpenses.filter(t=>t.category===cat).reduce((a,t)=>a+t.amount,0);
      tips.push(s > limit ? `🔴 ${cat}: ${s.toFixed(1)}€ de ${limit.toFixed(1)}€ — superado` : `🟡 ${cat}: ${s.toFixed(1)}€ de ${limit.toFixed(1)}€`);
    });
    if (discretionaryRemaining > 10 && goals.some(g => g.currentAmount < g.targetAmount)) {
      tips.push(`💪 Te sobran ${discretionaryRemaining.toFixed(0)}€ esta semana. Aporta ${Math.min(discretionaryRemaining, recommendedWeeklySaving || 5).toFixed(0)}€ a tu meta de ahorro.`);
    }
    if (recommendedWeeklySaving > 0 && discretionaryRemaining > recommendedWeeklySaving) {
      tips.push(`💰 Tienes suficiente para tu ahorro semanal (${recommendedWeeklySaving.toFixed(0)}€). ¡No lo dejes pasar!`);
    }
    const totalSaved = goals.reduce((s,g)=>s+g.currentAmount,0);
    if (totalSaved > 0) tips.push(`🏦 Llevas ${totalSaved.toFixed(0)}€ ahorrados en total.`);
    if (tips.length === 0) tips.push('➕ Crea metas de ahorro y añade límites para recibir consejos personalizados.');
    return tips.map(t => `<div style="padding:4px 0;font-size:14px;line-height:1.5">${t}</div>`).join('');
  },

  _renderOptimizer(weekExpenses, limits, budget, recommendedWeeklySaving, goals) {
    const catSpend = {};
    // weekExpenses is already filtered to spendable via BudgetEngine
    weekExpenses.forEach(t => {
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
    const weeklyRemaining = budget.discretionaryRemaining;
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
      const defaults = [['Comida', 40], ['Salidas', 20], ['Caprichos', 10]];
      for (const [cat, amt] of defaults) {
        if (!Store.getCategoryGroup(cat)) Store.setCategoryLimit(cat, amt);
      }
    }
  },

  /** @deprecated use BudgetEngine.getHistoricalStats() */
  _getSpendingStats() {
    const s = BudgetEngine.getHistoricalStats();
    return {
      avgMonthly: s.avgMonthlyExpense,
      avgWeekly: s.avgWeeklyExpense,
      avgDaily: s.avgDailyExpense,
      numMonths: s.numMonths,
      byMonth: s.byMonthExpense,
      catAvg: s.catAvg,
    };
  },

  _renderAutonomy(allExpenses, allIncome) {
    const stats = BudgetEngine.getHistoricalStats();
    const { avgMonthlyExpense: avgMonthly, avgWeeklyExpense: avgWeekly, avgDailyExpense: avgDaily, numMonths, byMonthExpense: byMonth, catAvg } = stats;

    if (numMonths < 1 || avgMonthly <= 0) return '';

    const checking = Store.getCheckingBalance() ?? 0;
    const savings = Store.getSavingsBalance() ?? 0;
    const totalWealth = checking + savings;
    const monthsAutonomy = avgMonthly > 0 ? totalWealth / avgMonthly : 0;
    const autonomyTarget = 6; // months considered "safe"
    const autonomyNeeded = Math.max(0, autonomyTarget * avgMonthly - totalWealth);

    // Category breakdown sorted by average
    const catEntries = Object.entries(catAvg)
      .filter(([c]) => !['Ahorro','Ahorro programado','__ajuste__'].includes(c))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const autonomyPct = Math.min(100, (monthsAutonomy / autonomyTarget) * 100);
    const autonomyColor = monthsAutonomy >= autonomyTarget ? 'var(--income)' : monthsAutonomy >= 3 ? '#F59E0B' : 'var(--expense)';
    const autonomyMsg = monthsAutonomy >= autonomyTarget
      ? `✅ Tienes reservas para ${monthsAutonomy.toFixed(1)} meses. ¡Objetivo de autonomía alcanzado!`
      : monthsAutonomy >= 3
        ? `🟡 Tienes para ${monthsAutonomy.toFixed(1)} meses. Objetivo: ${autonomyTarget} meses (faltan ${autonomyNeeded.toFixed(0)} €)`
        : `🔴 Solo tienes para ${monthsAutonomy.toFixed(1)} meses. Prioriza ahorrar para llegar a ${autonomyTarget} meses.`;

    const thisMonthKey = Store.getCurrentMonth();
    const thisMonthSpent = byMonth[thisMonthKey] || 0;
    const lastMonthKey = Object.keys(byMonth).filter(m => m < thisMonthKey).sort().reverse()[0];
    const lastMonthSpent = lastMonthKey ? byMonth[lastMonthKey] : null;
    const trend = lastMonthSpent !== null
      ? (thisMonthSpent > lastMonthSpent * 1.1 ? '📈 Más que el mes pasado' : thisMonthSpent < lastMonthSpent * 0.9 ? '📉 Menos que el mes pasado' : '➡️ Similar al mes pasado')
      : '';

    return `<div class="sa-card sa-card-autonomy" style="border-left:3px solid #10B981">
      <div class="card-header">
        <span class="card-title">🏦 Autonomía financiera</span>
        <span style="font-size:11px;color:var(--text-secondary)">${numMonths} mes${numMonths !== 1 ? 'es' : ''} de datos</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Media diaria</div>
          <div style="font-size:18px;font-weight:800;color:var(--expense)">${avgDaily.toFixed(1)} €</div>
        </div>
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Media semanal</div>
          <div style="font-size:18px;font-weight:800;color:var(--expense)">${avgWeekly.toFixed(1)} €</div>
        </div>
        <div style="text-align:center;padding:10px;background:var(--bg);border-radius:10px">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Media mensual</div>
          <div style="font-size:18px;font-weight:800;color:var(--expense)">${avgMonthly.toFixed(1)} €</div>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700">Meses de autonomía con tu saldo actual</span>
          <span style="font-size:15px;font-weight:800;color:${autonomyColor}">${monthsAutonomy.toFixed(1)} / ${autonomyTarget}</span>
        </div>
        <div class="progress-bar" style="height:12px;border-radius:6px">
          <div class="progress-fill" style="width:${autonomyPct}%;background:${autonomyColor};border-radius:6px;transition:width .6s ease"></div>
        </div>
        <div style="font-size:12px;margin-top:6px;font-weight:600;color:${autonomyColor}">${autonomyMsg}</div>
      </div>

      ${catEntries.length > 0 ? `
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.3px">🏷️ En qué gastas de media al mes</div>
        ${catEntries.map(([cat, avg]) => {
          const pct = avgMonthly > 0 ? Math.min(100, (avg / avgMonthly) * 100) : 0;
          return `<div style="margin-bottom:5px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
              <span style="font-weight:600">${esc(cat)}</span>
              <span>${avg.toFixed(1)} € <span style="color:var(--text-secondary)">(${pct.toFixed(0)}%)</span></span>
            </div>
            <div class="progress-bar" style="height:5px"><div class="progress-fill" style="width:${pct}%;background:var(--primary);border-radius:3px"></div></div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${trend ? `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">${trend} · Este mes: <strong>${thisMonthSpent.toFixed(0)} €</strong></div>` : ''}

      ${autonomyNeeded > 0 ? `<div style="margin-top:10px;padding:8px 12px;background:#F0FDF4;border-radius:8px;font-size:12px;color:#166534">
        💡 Para tener 6 meses de reserva necesitas ahorrar <strong>${autonomyNeeded.toFixed(0)} €</strong> más.
        A tu ritmo actual (${avgMonthly.toFixed(0)} €/mes de gastos), con ahorrar <strong>${Math.ceil(autonomyNeeded / 6).toFixed(0)} €/mes</strong> durante 6 meses lo conseguirías.
      </div>` : ''}
    </div>`;
  },

  _calc() {
    // Delegate to BudgetEngine for consistent calculations.
    const b = BudgetEngine.calcWeekly();
    // Keep old shape for backward-compat with remaining callers
    return {
      weeklyIncome: Store.getBudgetWeeklyIncome(),
      monthlyExtra: Store.getBudgetMonthlyExtra(),
      totalWeekly: b.totalWeekly,
      actualExpense: b.weekTotalSpent,
      remaining: b.discretionaryRemaining,
      daysLeft: b.daysLeft,
      week: b.week,
      // New fields
      discretionaryBudget: b.discretionaryBudget,
      discretionaryRemaining: b.discretionaryRemaining,
      dailySpendable: b.dailySpendable,
    };
  },

  _getCurrentWeek() {
    return BudgetEngine.getCurrentWeekBounds();
  },

  _getWeekTransactions() {
    return BudgetEngine.getWeekSpendableExpenses();
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
    const result = BudgetEngine.checkCategoryLimit(category, amount);
    if (!result) return null;
    return {
      limit: result.limit,
      alreadySpent: result.alreadySpent,
      projectedTotal: result.projected,
      level: result.level,
    };
  },


  _saveIncome() {
    if (typeof Categorias !== 'undefined') Categorias._saveIncome();
  },

  _saveFoodBudget() {
    const v = parseFloat(document.getElementById('foodBudgetInput').value);
    if (v > 0) Store.setFoodBudget(v);
    this.render();
  },

  _renderFoodCategoryChips(categories) {
    const foodCats = Store.getFoodCategories();
    if (foodCats.length === 0) return '<span style="font-size:12px;color:var(--text-secondary)">Ninguna seleccionada</span>';
    return foodCats.map(c => `
      <span class="food-cat-chip">
        ${esc(c)}
        <button onclick="Presupuesto._removeFoodCategory('${esc(c)}')" title="Quitar" style="background:none;border:none;cursor:pointer;margin-left:2px;font-size:11px;color:var(--expense)">✕</button>
      </span>`).join('');
  },

  _addFoodCategory() {
    const sel = document.getElementById('foodCatAdd');
    const cat = sel?.value;
    if (!cat) return;
    Store.addFoodCategory(cat);
    this.render();
  },

  _removeFoodCategory(cat) {
    Store.removeFoodCategory(cat);
    this.render();
  },

  _renderMonthVariance() {
    const v = BudgetEngine.getMonthVariance();
    const monthStr = MONTHS[parseInt(v.month.split('-')[1]) - 1] + ' ' + v.month.split('-')[0];
    const pctMonth = v.daysInMonth > 0 ? Math.round((v.dayOfMonth / v.daysInMonth) * 100) : 0;
    const isCurrentMonth = v.month === Store.getCurrentMonth();

    const rows = [
      {
        icon: '🍽️', label: 'Alimentación',
        budget: v.foodBudget, spent: v.foodSpent,
        color: '#F59E0B',
        detail: 'food',
      },
      {
        icon: '⚠️', label: 'Imprevistos',
        budget: v.imprevistosBudget, spent: v.imprevistosSpent,
        color: '#EC4899',
        detail: 'imprevistos',
        hide: !Store.isImprevistosInPlan(),
      },
    ];

    const rowHtml = rows.filter(r => r.budget > 0 && !r.hide).map(r => {
      const pct = r.budget > 0 ? Math.min(120, (r.spent / r.budget) * 100) : 0;
      const remaining = r.budget - r.spent;
      const statusColor = pct >= 100 ? 'var(--expense)' : pct >= 80 ? '#F97316' : 'var(--income)';
      return `<div class="pv-row" onclick="Presupuesto._togglePVDetail('${r.detail}')">
        <div class="pv-row-top">
          <span class="pv-row-label">${r.icon} ${r.label}</span>
          <span class="pv-row-nums">
            <span class="pv-spent" style="color:${statusColor}">${r.spent.toFixed(2)} €</span>
            <span class="pv-sep">/</span>
            <span class="pv-budget">${r.budget.toFixed(0)} €</span>
          </span>
        </div>
        <div class="pv-bar-wrap">
          <div class="pv-bar-fill" style="width:${Math.min(100,pct)}%;background:${r.color}"></div>
          ${isCurrentMonth ? `<div class="pv-bar-pace-marker" style="left:${pctMonth}%" title="Ritmo esperado ${pctMonth}%"></div>` : ''}
        </div>
        <div class="pv-row-bot">
          <span>${pct.toFixed(0)}% consumido</span>
          <span style="color:${remaining >= 0 ? 'var(--income)' : 'var(--expense)'}">
            ${remaining >= 0 ? `${remaining.toFixed(2)} € restantes` : `${Math.abs(remaining).toFixed(2)} € pasado`}
          </span>
        </div>
        <div id="pv-detail-${r.detail}" style="display:none;margin-top:6px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:12px">
          ${this._renderPVDetail(r.detail, v)}
        </div>
      </div>`;
    }).join('');

    // Category breakdown
    const catRows = Object.entries(v.byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, spent]) => {
        const limit = v.limits[cat];
        const pct = limit ? Math.min(120, (spent / limit) * 100) : 0;
        const color = pct >= 100 ? 'var(--expense)' : pct >= 80 ? '#F97316' : '#6366F1';
        return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
          <span style="flex:1;font-size:12px;font-weight:500">${esc(cat)}</span>
          ${limit ? `<div style="width:60px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100,pct)}%;background:${color};border-radius:3px"></div>
          </div>` : ''}
          <span style="font-size:12px;font-weight:700;color:${color};min-width:54px;text-align:right">${spent.toFixed(2)} €</span>
        </div>`;
      }).join('');

    const projLabel = isCurrentMonth && v.dayOfMonth < v.daysInMonth
      ? `Proyección fin de mes: <strong style="color:${v.projectedMonthTotal > v.monthlyIncome ? 'var(--expense)' : 'var(--income)'}">~${v.projectedMonthTotal.toFixed(0)} €</strong> (ritmo ${v.dailyPace.toFixed(2)} €/día)`
      : '';

    return `<div class="sa-card sa-card-monthvariance">
      <div class="card-header">
        <span class="card-title">📅 Seguimiento mensual — ${monthStr}</span>
        ${isCurrentMonth ? `<span style="font-size:12px;color:var(--text-secondary)">Día ${v.dayOfMonth}/${v.daysInMonth}</span>` : ''}
      </div>
      <div class="pv-total-row">
        <span>Total gastado (real)</span>
        <strong style="font-size:18px;color:var(--expense)">${v.totalSpent.toFixed(2)} €</strong>
      </div>
      ${projLabel ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">${projLabel}</div>` : ''}
      ${rowHtml}
      ${catRows ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">📊 Por categoría este mes:</div>
        ${catRows}
      </div>` : ''}
    </div>`;
  },

  _togglePVDetail(key) {
    const el = document.getElementById(`pv-detail-${key}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
  },

  _renderPVDetail(key, variance) {
    const month = variance.month;
    let cats = [];
    if (key === 'food') cats = Store.getFoodCategories();
    else if (key === 'imprevistos') cats = ['Imprevisto'];
    const txs = Store.getTransactions()
      .filter(t => t.month === month && (key === 'food' ? Store.isFoodCategory(t.category) : Store.categoryInList(t.category, cats)) && Store.isSpendableExpense(t))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    if (!txs.length) return '<span style="color:var(--text-secondary)">Sin movimientos</span>';
    return txs.map(t => `<div style="display:flex;justify-content:space-between;padding:2px 0">
      <span>${esc(t.description || t.category)}</span>
      <span style="font-weight:600;color:var(--expense)">${t.amount.toFixed(2)} €</span>
    </div>`).join('');
  },

  _savePlanFood() {
    const v = parseFloat(document.getElementById('planFoodBudget').value);
    if (v > 0) { Store.setFoodBudget(v); this.render(); }
  },

  _enablePlanImprevistos() {
    Store.enableImprevistosInPlan({ autoAdjust: true });
    App.showToast(`✅ Imprevistos activados (${Store.getRecommendedImprevistosBudget().toFixed(0)} €/mes recomendados)`);
    this.render();
  },

  _togglePlanImprevistos() {
    const on = document.getElementById('planImprevistosEnabled')?.checked;
    if (on) Store.enableImprevistosInPlan({ autoAdjust: true });
    else Store.disableImprevistosInPlan();
    this.render();
  },

  _savePlanImprevistos() {
    const v = parseFloat(document.getElementById('planImprevistosBudget')?.value);
    if (v >= 0) {
      if (!Store.isImprevistosInPlan()) Store.enableImprevistosInPlan({ budget: v, autoAdjust: false });
      else Store.setImprevistosBudget(v);
      this.render();
    }
  },

  _toggleImprevistosAuto() {
    const on = document.getElementById('planImprevistosAuto')?.checked;
    Store.setImprevistosAutoAdjust(on);
    if (on && Store._autoAdjustImprevistosBudget()) Store.setImprevistosBudget(Store.getImprevistosBudget());
    this.render();
  },

  _saveImprevistosBudget() {
    const v = parseFloat(document.getElementById('imprevistosBudgetInput').value);
    if (v >= 0) {
      if (!Store.isImprevistosInPlan()) Store.enableImprevistosInPlan({ budget: v, autoAdjust: false });
      else Store.setImprevistosBudget(v);
      this.render();
    }
  },

  _addLimit() {
    const cat = document.getElementById('newLimitCategory').value;
    const amt = parseFloat(document.getElementById('newLimitAmount').value);
    if (!cat || !amt || amt <= 0) return;
    if (Store.getCategoryGroup(cat)) {
      App.showToast(`"${cat}" está en un grupo — edita el presupuesto mensual del grupo en Ajustes`);
      return;
    }
    const budget = this._calc();
    const ungroupedLimits = Store.getUngroupedCategoryLimits();
    const oldCatLimit = ungroupedLimits[cat] || 0;
    const groupsWeekly = Store.getTrackingBudgetWeeklyTotal() - Object.values(ungroupedLimits).reduce((s, v) => s + v, 0);
    const totalOther = Object.entries(ungroupedLimits).filter(([c]) => c !== cat).reduce((s, [, v]) => s + v, 0);
    const newTotal = groupsWeekly + totalOther + amt;
    const foodBudget = Store.getFoodBudget();
    const foodWeekly = foodBudget / 4.33;
    const goals = Store.getSavingGoals();
    const recommendedWeeklySaving = Store.getRecommendedWeeklySaving(goals);
    const peWeekly = Store.getPlannedExpensesWeeklyNeed();
    const imprevistosBudget = Store.getEffectiveImprevistosBudget();
    const imprevistosWeekly = imprevistosBudget / 4.33;
    const totalDeductions = foodWeekly + recommendedWeeklySaving + peWeekly + imprevistosWeekly;
    const available = budget.totalWeekly - totalDeductions;
    if (newTotal > Math.max(0, available)) {
      App.showToast(`🔴 No añadido — seguimiento total (${newTotal.toFixed(0)}€/sem) supera disponible (${Math.max(0, available).toFixed(0)}€/sem)`);
      return;
    }
    if (!Store.setCategoryLimit(cat, amt)) {
      App.showToast(`"${cat}" pertenece a un grupo — usa presupuesto mensual del grupo`);
      return;
    }
    this.render();
  },

  _removeLimit(cat) { Store.removeCategoryLimit(cat); this.render(); },

  _editLimit(cat) {
    const limits = Store.getCategoryLimits();
    const current = limits[cat] || 0;
    const weekExpenses = this._getWeekTransactions().filter(t => Store.isSpendableExpense(t));
    const spent = weekExpenses.filter(t => Store._categoryKeysMatch(t.category, cat)).reduce((s, t) => s + t.amount, 0);
    App.showCustom(`✏️ Límite semanal — ${cat}`, `
      <div style="margin-bottom:10px;padding:8px 12px;background:var(--bg);border-radius:8px;font-size:13px">
        <span>Gastado esta semana: </span><strong style="color:var(--expense)">${spent.toFixed(2)} €</strong>
      </div>
      <div class="form-group">
        <label>Nuevo límite semanal (€)</label>
        <input type="number" id="editLimitInput" value="${current}" step="1" min="1"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
      </div>
    `, 'Guardar', () => {
      const amt = parseFloat(document.getElementById('editLimitInput')?.value);
      if (!amt || amt <= 0) return;
      Store.setCategoryLimit(cat, amt);
      this.render();
      App.showToast(`✅ Límite de ${cat} actualizado a ${amt.toFixed(0)} €/sem`);
    });
    setTimeout(() => {
      const inp = document.getElementById('editLimitInput');
      if (inp) { inp.focus(); inp.select(); }
    }, 80);
  },

  _goalFormHtml(g = null) {
    const isEdit = !!g;
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group"><label>Nombre</label><input type="text" id="goalNameInput" value="${isEdit ? esc(g.name) : ''}" placeholder="Ej: Navidad 2026" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%"></div>
        <div class="form-group"><label>Objetivo (€)</label><input type="number" id="goalTargetInput" value="${isEdit ? g.targetAmount : ''}" placeholder="500" step="10" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%"></div>
        ${isEdit ? `<div class="form-group"><label>Cantidad actual ahorrada (€)</label><input type="number" id="goalCurrentInput" value="${g.currentAmount}" step="1" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%"></div>` : ''}
        <div class="form-group"><label>¿Para cuándo quieres conseguirlo?</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
            <button type="button" class="btn-sm gc-range" onclick="Presupuesto._quickDate(3)">3 meses</button>
            <button type="button" class="btn-sm gc-range" onclick="Presupuesto._quickDate(6)">6 meses</button>
            <button type="button" class="btn-sm gc-range" onclick="Presupuesto._quickDate(12)">1 año</button>
            <button type="button" class="btn-sm gc-range" onclick="Presupuesto._quickDate(24)">2 años</button>
          </div>
          <input type="date" id="goalDateInput" value="${isEdit && g.targetDate ? g.targetDate : ''}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);width:100%">
        </div>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center" id="goalDatePreview">Sin fecha definida — calcularemos el tiempo estimado</div>
      </div>`;
  },

  _bindGoalFormExtras() {
    const inp = document.getElementById('goalDateInput');
    if (inp) inp.addEventListener('change', () => { this._updateGoalDatePreview(); });
    this._updateGoalDatePreview();
  },

  _addGoal() {
    App.openModal({
      title: 'Nueva meta de ahorro',
      body: this._goalFormHtml(),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Crear',
          primary: true,
          cb: () => {
            const name = document.getElementById('goalNameInput')?.value.trim();
            const target = parseFloat(document.getElementById('goalTargetInput')?.value);
            const date = document.getElementById('goalDateInput')?.value;
            if (!name || !target || target <= 0) {
              App.showToast('⚠️ Indica nombre y objetivo válido');
              setTimeout(() => this._addGoal(), 80);
              return;
            }
            Store.addSavingGoal(name, target, date || undefined);
            this.render();
            App.showToast('✅ Meta creada');
          },
        },
      ],
    });
    this._bindGoalFormExtras();
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
    App.openModal({
      title: 'Editar meta',
      body: this._goalFormHtml(g),
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Guardar',
          primary: true,
          cb: () => {
            const name = document.getElementById('goalNameInput')?.value.trim();
            const target = parseFloat(document.getElementById('goalTargetInput')?.value);
            const current = parseFloat(document.getElementById('goalCurrentInput')?.value) || 0;
            const date = document.getElementById('goalDateInput')?.value;
            if (!name || !target || target <= 0) {
              App.showToast('⚠️ Indica nombre y objetivo válido');
              setTimeout(() => this._editGoal(id), 80);
              return;
            }
            Store.updateSavingGoal(id, {
              name,
              targetAmount: target,
              currentAmount: Math.min(current, target),
              targetDate: date || '',
            });
            this.render();
            App.showToast('✅ Meta actualizada');
          },
        },
      ],
    });
    this._bindGoalFormExtras();
  },

  _contributeGoal(id) {
    const g = Store.getSavingGoals().find(x => x.id === id);
    if (!g || g.currentAmount >= g.targetAmount) return;
    App.openModal({
      title: `Aportar a "${g.name}"`,
      body: `
      <div class="form-group">
        <label>Cantidad a añadir (€)</label>
        <input type="number" id="goalContributeInput" value="5" step="1" min="0.01" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700;width:100%">
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-top:8px">Faltan ${(g.targetAmount - g.currentAmount).toFixed(0)} € para alcanzar la meta</p>
    `,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Aportar',
          primary: true,
          cb: () => {
            const amt = parseFloat(document.getElementById('goalContributeInput')?.value);
            if (!amt || amt <= 0) {
              App.showToast('⚠️ Indica una cantidad válida');
              setTimeout(() => this._contributeGoal(id), 80);
              return;
            }
            Store.contributeToGoal(id, amt);
            this.render();
            App.showToast('✅ Aportación registrada');
          },
        },
      ],
    });
  },

  _deleteGoal(id) {
    const g = Store.getSavingGoals().find(x => x.id === id);
    if (!g) return;
    App.showConfirm('Eliminar meta', `¿Eliminar "${g.name}"?`, () => { Store.deleteSavingGoal(id); this.render(); });
  },


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
