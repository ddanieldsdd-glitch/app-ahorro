/**
 * BudgetEngine — motor financiero centralizado.
 * Todos los cálculos de presupuesto, gasto real, plan vs real y
 * proyecciones se centralizan aquí para que todas las pantallas
 * (Ahorro, Dashboard, Registro, Calendario) usen exactamente
 * los mismos números y periodos.
 */
const BudgetEngine = {

  // ── Periodos ──────────────────────────────────────────────────────────────

  getCurrentWeekBounds() {
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

  getMonthBounds(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return {
      start: new Date(y, m - 1, 1, 0, 0, 0),
      end:   new Date(y, m, 0, 23, 59, 59),
    };
  },

  // ── Transacciones filtradas ───────────────────────────────────────────────

  /**
   * Gastos reales gastables de la semana actual.
   * Excluye traspasos, ajustes, operaciones internas de ahorro y deudas pendientes.
   */
  getWeekSpendableExpenses() {
    const { start, end } = this.getCurrentWeekBounds();
    return Store.getTransactions().filter(t => {
      if (!Store.isSpendableExpense(t)) return false;
      const d = new Date(t.date + 'T00:00:00');
      return d >= start && d <= end;
    });
  },

  /**
   * Gastos reales gastables de un mes (acepta string 'YYYY-MM' o usa el mes actual).
   */
  getMonthSpendableExpenses(month) {
    const m = month || Store.getCurrentMonth();
    return Store.getTransactions().filter(t => t.month === m && Store.isSpendableExpense(t));
  },

  /** Todos los gastos de alimentación del mes actual según categorías configuradas */
  getMonthFoodSpending(month) {
    const m = month || Store.getCurrentMonth();
    const foodCats = Store.getFoodCategories();
    return Store.getTransactions()
      .filter(t => t.month === m && foodCats.includes(t.category) && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  /** Gastos de imprevistos del mes (categoría exacta 'Imprevisto') */
  getMonthImprevistosSpending(month) {
    const m = month || Store.getCurrentMonth();
    return Store.getTransactions()
      .filter(t => t.month === m && t.category === 'Imprevisto' && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  // ── Ingresos configurados ─────────────────────────────────────────────────

  getWeeklyIncome() {
    return Store.getBudgetWeeklyIncome() + Store.getBudgetMonthlyExtra() / 4.33;
  },

  // ── Allocaciones del plan ─────────────────────────────────────────────────

  getAllocations() {
    const goals = Store.getSavingGoals();
    const foodWeekly           = Store.getEffectiveFoodBudget() / 4.33;
    const savingWeekly         = Store.getRecommendedWeeklySaving(goals);
    const plannedExpWeekly     = Store.getPlannedExpensesWeeklyNeed();
    const imprevistosWeekly    = Store.getImprevistosBudget() / 4.33;
    return { foodWeekly, savingWeekly, plannedExpWeekly, imprevistosWeekly };
  },

  // ── Cálculo principal semanal ─────────────────────────────────────────────

  /**
   * Equivalente a Presupuesto._calc() pero con filtros correctos.
   * Usa isSpendableExpense para no doble-contar ahorro interno.
   */
  calcWeekly() {
    const totalWeekly   = this.getWeeklyIncome();
    const { foodWeekly, savingWeekly, plannedExpWeekly, imprevistosWeekly } = this.getAllocations();
    const totalDeductions = foodWeekly + savingWeekly + plannedExpWeekly + imprevistosWeekly;
    const discretionaryBudget = Math.max(0, totalWeekly - totalDeductions);

    const week = this.getCurrentWeekBounds();
    const weekExpenses = this.getWeekSpendableExpenses();
    const weekFoodSpent = weekExpenses
      .filter(t => Store.isFoodCategory(t.category))
      .reduce((s, t) => s + t.amount, 0);
    const weekDiscSpent = weekExpenses
      .filter(t => !Store.isFoodCategory(t.category) && t.category !== 'Imprevisto')
      .reduce((s, t) => s + t.amount, 0);
    const weekTotalSpent = weekExpenses.reduce((s, t) => s + t.amount, 0);

    const today = new Date();
    const daysLeft = Math.max(0, Math.ceil((week.end.getTime() - today.getTime()) / 86400000));
    const remainingDays = today.getHours() < 12 ? daysLeft + 1 : daysLeft;

    const discretionaryRemaining = Math.max(0, discretionaryBudget - weekDiscSpent);
    const dailySpendable = remainingDays > 0 ? discretionaryRemaining / remainingDays : 0;

    return {
      totalWeekly,
      totalDeductions,
      discretionaryBudget,
      foodWeekly,
      savingWeekly,
      plannedExpWeekly,
      imprevistosWeekly,
      weekTotalSpent,
      weekFoodSpent,
      weekDiscSpent,
      discretionaryRemaining,
      dailySpendable,
      daysLeft: remainingDays,
      week,
      weekExpenses,
    };
  },

  // ── Plan vs Real (mensual) ────────────────────────────────────────────────

  getMonthVariance(month) {
    const m = month || Store.getCurrentMonth();
    const foodBudget = Store.getEffectiveFoodBudget();
    const imprevistosBudget = Store.getImprevistosBudget();
    const limits = Store.getCategoryLimits();

    const expenses = this.getMonthSpendableExpenses(m);
    const foodSpent = expenses
      .filter(t => Store.isFoodCategory(t.category))
      .reduce((s, t) => s + t.amount, 0);
    const imprevistosSpent = expenses
      .filter(t => t.category === 'Imprevisto')
      .reduce((s, t) => s + t.amount, 0);
    const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);

    // Monthly income configured
    const monthlyIncome = Store.getBudgetWeeklyIncome() * 4.33 + Store.getBudgetMonthlyExtra();

    // By category
    const byCat = {};
    for (const t of expenses) {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }

    // Days in month
    const [y, mo] = m.split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    const today = new Date();
    const dayOfMonth = m === Store.getCurrentMonth() ? Math.min(today.getDate(), daysInMonth) : daysInMonth;
    const dailyPace = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
    const projectedMonthTotal = dailyPace * daysInMonth;

    return {
      month: m,
      monthlyIncome,
      foodBudget,
      foodSpent,
      foodRemaining: foodBudget - foodSpent,
      imprevistosBudget,
      imprevistosSpent,
      imprevistosRemaining: imprevistosBudget - imprevistosSpent,
      totalSpent,
      projectedMonthTotal,
      dailyPace,
      dayOfMonth,
      daysInMonth,
      byCat,
      limits,
    };
  },

  // ── Grupos de categoría ───────────────────────────────────────────────────

  /** Returns week spending total for categories in a given group */
  getGroupWeekSpending(groupId) {
    const groups = Store.getCategoryGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return 0;
    const weekExpenses = this.getWeekSpendableExpenses();
    return weekExpenses
      .filter(t => group.categories.includes(t.category))
      .reduce((s, t) => s + t.amount, 0);
  },

  /** Returns month spending total for categories in a given group */
  getGroupMonthSpending(groupId, month) {
    const groups = Store.getCategoryGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return 0;
    const m = month || Store.getCurrentMonth();
    return Store.getTransactions()
      .filter(t => t.month === m && group.categories.includes(t.category) && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  // ── Guía de ahorro inteligente ────────────────────────────────────────────

  /**
   * Calcula la guía de ahorro recomendada según el ingreso mensual.
   * Devuelve porcentajes y cantidades semanales/mensuales recomendados.
   */
  getSmartSavingsGuide() {
    const weeklyIncome = Store.getBudgetWeeklyIncome();
    const monthlyExtra = Store.getBudgetMonthlyExtra();
    const monthlyIncome = weeklyIncome * 4.33 + monthlyExtra;

    let savingPct, imprevistosPct, label, advice, color;

    if (monthlyIncome < 800) {
      savingPct = 5;
      imprevistosPct = 5;
      label = 'Ingresos bajos';
      color = '#F59E0B';
      advice = 'Con ingresos ajustados, ahorra al menos el 5% y mantén un colchón mínimo del 5% para emergencias. Prioriza reducir gastos fijos.';
    } else if (monthlyIncome < 2000) {
      savingPct = 10;
      imprevistosPct = 10;
      label = 'Ingresos medios';
      color = '#4F46E5';
      advice = 'Aplica la regla 10/10/80: 10% a ahorro, 10% a emergencias, 80% para gastos. Es el equilibrio ideal para esta franja de ingresos.';
    } else {
      savingPct = 20;
      imprevistosPct = 10;
      label = 'Ingresos altos';
      color = '#10B981';
      advice = 'Con ingresos altos puedes aplicar la regla 50/30/20: 50% necesidades, 30% deseos, 20% ahorro. El 10% de imprevistos te da seguridad adicional.';
    }

    const monthlySaving = monthlyIncome * savingPct / 100;
    const monthlyImprevisto = monthlyIncome * imprevistosPct / 100;
    const weeklySaving = monthlySaving / 4.33;
    const weeklyImprevisto = monthlyImprevisto / 4.33;

    const currentWeeklySaving = Store.getRecommendedWeeklySaving(Store.getSavingGoals());
    const currentImprevistosBudget = Store.getImprevistosBudget();

    return {
      monthlyIncome,
      savingPct,
      imprevistosPct,
      label,
      color,
      advice,
      monthlySaving,
      monthlyImprevisto,
      weeklySaving,
      weeklyImprevisto,
      currentWeeklySaving,
      currentImprevistosBudget,
    };
  },

  /**
   * Calcula métricas de sostenibilidad financiera.
   * Evalúa si el ritmo actual permite mantenerse a lo largo de los meses.
   */
  getSustainabilityMetrics() {
    const checkingBalance = Store.getCheckingBalance() ?? 0;
    const savingsBalance = Store.getSavingsBalance();
    const cashBalance = Store.getCashBalance();
    const totalWealth = checkingBalance + savingsBalance + cashBalance;
    const monthlyIncome = Store.getBudgetWeeklyIncome() * 4.33 + Store.getBudgetMonthlyExtra();

    // Compute average monthly expense from last 3 months of data
    const archives = Store.getArchives();
    const archiveMonths = Object.keys(archives).sort().slice(-3);
    let totalArchivedExpense = 0;
    let archivedMonthCount = 0;
    for (const m of archiveMonths) {
      const txs = archives[m];
      const monthExp = txs.filter(t => Store.isSpendableExpense(t)).reduce((s, t) => s + t.amount, 0);
      totalArchivedExpense += monthExp;
      archivedMonthCount++;
    }
    // Include current month
    const currentMonthExp = this.getMonthSpendableExpenses().reduce((s, t) => s + t.amount, 0);
    const totalMonths = archivedMonthCount + 1;
    const avgMonthlyExpense = (totalArchivedExpense + currentMonthExp) / totalMonths;

    const savingRate = monthlyIncome > 0 ? (monthlyIncome - avgMonthlyExpense) / monthlyIncome : 0;
    const monthsOfAutonomy = avgMonthlyExpense > 0 ? totalWealth / avgMonthlyExpense : 0;
    const projectedIn6Months = totalWealth + savingRate * monthlyIncome * 6;

    // Sustainability status
    let status, statusLabel, statusAdvice;
    if (avgMonthlyExpense > monthlyIncome) {
      status = 'danger';
      statusLabel = 'Déficit mensual';
      statusAdvice = `Gastas ${(avgMonthlyExpense - monthlyIncome).toFixed(2)} € más de lo que ingresas. Reduce gastos o aumenta ingresos urgentemente.`;
    } else if (avgMonthlyExpense > monthlyIncome * 0.9) {
      status = 'warning';
      statusLabel = 'Margen ajustado';
      statusAdvice = `Solo ahorras el ${(savingRate * 100).toFixed(1)}% de tus ingresos. Intenta reducir gastos para ampliar el margen.`;
    } else if (monthsOfAutonomy < 3) {
      status = 'warning';
      statusLabel = 'Colchón bajo';
      statusAdvice = `Tienes autonomía para ${monthsOfAutonomy.toFixed(1)} meses. Construye un fondo de emergencia de al menos 3 meses.`;
    } else {
      status = 'good';
      statusLabel = 'Situación saludable';
      statusAdvice = `Ahorras el ${(savingRate * 100).toFixed(1)}% de tus ingresos y tienes ${monthsOfAutonomy.toFixed(1)} meses de autonomía. ¡Sigue así!`;
    }

    return {
      totalWealth,
      monthlyIncome,
      avgMonthlyExpense,
      savingRate,
      monthsOfAutonomy,
      projectedIn6Months,
      status,
      statusLabel,
      statusAdvice,
    };
  },

  /**
   * Devuelve categorías de gasto que tienen movimientos en el mes actual
   * pero no están asignadas a ningún grupo de categorías.
   */
  getUncategorizedCategories() {
    const groups = Store.getCategoryGroups();
    const allGroupedCats = new Set(groups.flatMap(g => g.categories));
    const currentMonth = Store.getCurrentMonth();
    const monthExpenses = this.getMonthSpendableExpenses(currentMonth);

    const usedCats = new Set(monthExpenses.map(t => t.category));
    const uncategorized = [];
    for (const cat of usedCats) {
      if (!allGroupedCats.has(cat)) {
        const total = monthExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
        uncategorized.push({ name: cat, total });
      }
    }
    uncategorized.sort((a, b) => b.total - a.total);
    return uncategorized;
  },

  // ── Resúmenes semanal / mensual ───────────────────────────────────────────

  PRIORITY_LABELS: {
    1: { label: 'Esencial', short: 'P1', color: '#059669', tip: 'Proteger siempre' },
    2: { label: 'Alta', short: 'P2', color: '#2563EB', tip: 'Recortar solo si es necesario' },
    3: { label: 'Media', short: 'P3', color: '#D97706', tip: 'Ajustable' },
    4: { label: 'Baja', short: 'P4', color: '#EA580C', tip: 'Candidato a recorte' },
    5: { label: 'Dispensable', short: 'P5', color: '#DC2626', tip: 'Recortar primero' },
  },

  getPriorityMeta(priority) {
    return this.PRIORITY_LABELS[priority] || this.PRIORITY_LABELS[3];
  },

  _fmtDate(d) {
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  },

  /**
   * Resumen de ingresos y gastos de la semana actual o del mes.
   * period: 'week' | 'month'
   */
  getPeriodSummary(period = 'week', month) {
    const isWeek = period === 'week';
    const m = month || Store.getCurrentMonth();
    let start, end, expenses, incomes;

    if (isWeek) {
      ({ start, end } = this.getCurrentWeekBounds());
      expenses = this.getWeekSpendableExpenses();
      incomes = Store.getTransactions().filter(t => {
        if (t.type !== 'Ingreso' || Store.isAdjustment(t)) return false;
        const d = new Date(t.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    } else {
      ({ start, end } = this.getMonthBounds(m));
      expenses = this.getMonthSpendableExpenses(m);
      incomes = Store.getTransactions().filter(t =>
        t.month === m && t.type === 'Ingreso' && !Store.isAdjustment(t)
      );
    }

    const expenseTotal = expenses.reduce((s, t) => s + t.amount, 0);
    const incomeActual = incomes.reduce((s, t) => s + t.amount, 0);
    const weeklyIncomeCfg = this.getWeeklyIncome();
    const incomeConfigured = isWeek ? weeklyIncomeCfg : weeklyIncomeCfg * 4.33;

    const byCatMap = {};
    for (const t of expenses) {
      byCatMap[t.category] = (byCatMap[t.category] || 0) + t.amount;
    }

    const groups = Store.getCategoryGroups();
    const limits = Store.getCategoryLimits();
    const byGroup = groups.map(g => {
      const spent = expenses
        .filter(t => g.categories.includes(t.category))
        .reduce((s, t) => s + t.amount, 0);
      const monthlyBudget = g.monthlyBudget || 0;
      const budget = isWeek ? monthlyBudget / 4.33 : monthlyBudget;
      const priority = Store.getGroupPriority(g.id);
      return {
        id: g.id,
        name: g.name,
        emoji: Store.getGroupDisplayEmoji(g),
        isFoodGroup: !!g.isFoodGroup,
        spent,
        budget,
        monthlyBudget,
        weeklyBudget: monthlyBudget / 4.33,
        priority,
        pct: budget > 0 ? (spent / budget) * 100 : 0,
      };
    }).filter(g => g.spent > 0 || g.budget > 0)
      .sort((a, b) => b.spent - a.spent);

    const groupedCats = new Set(groups.flatMap(g => g.categories));
    const byCategory = Object.entries(byCatMap)
      .map(([name, spent]) => {
        const limit = limits[name] || 0;
        const budget = isWeek ? limit : limit * 4.33;
        return {
          name,
          spent,
          budget,
          weeklyLimit: limit,
          inGroup: groupedCats.has(name),
          priority: Store.getCategoryPriority(name),
          pct: budget > 0 ? (spent / budget) * 100 : 0,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const byIncomeCat = {};
    for (const t of incomes) {
      byIncomeCat[t.category || 'Otros'] = (byIncomeCat[t.category || 'Otros'] || 0) + t.amount;
    }

    return {
      period,
      month: m,
      start,
      end,
      label: isWeek
        ? `${this._fmtDate(start)} – ${this._fmtDate(end)}`
        : `${MONTHS[parseInt(m.split('-')[1], 10) - 1]} ${m.split('-')[0]}`,
      expenseTotal,
      incomeActual,
      incomeConfigured,
      balanceActual: incomeActual - expenseTotal,
      balanceVsPlan: incomeConfigured - expenseTotal,
      byGroup,
      byCategory,
      byIncomeCat,
      topExpenses: byCategory.slice(0, 6),
    };
  },

  /**
   * Recomendaciones de variación de presupuesto semanal/mensual
   * según gasto real y prioridades configuradas.
   */
  getBudgetRecommendations() {
    const month = Store.getCurrentMonth();
    const mv = this.getMonthVariance(month);
    const weekSum = this.getPeriodSummary('week');
    const monthSum = this.getPeriodSummary('month', month);
    const frac = mv.daysInMonth > 0 ? Math.max(0.15, mv.dayOfMonth / mv.daysInMonth) : 1;
    const recommendations = [];
    let rid = 0;

    const push = (rec) => {
      recommendations.push({ id: 'rec_' + (++rid), ...rec });
    };

    const roundNice = (n) => {
      if (n <= 0) return 0;
      if (n < 20) return Math.round(n);
      if (n < 100) return Math.round(n / 5) * 5;
      return Math.round(n / 10) * 10;
    };

    // ── Food ──────────────────────────────────────────────────────────────
    if (mv.foodBudget > 0) {
      const projected = frac > 0 ? mv.foodSpent / frac : mv.foodSpent;
      const foodPriority = (() => {
        const fg = Store.getCategoryGroups().find(g => g.isFoodGroup);
        return fg ? Store.getGroupPriority(fg.id) : 1;
      })();
      const overPct = mv.foodBudget > 0 ? (projected / mv.foodBudget) : 0;
      if (overPct > 1.08) {
        if (foodPriority <= 2) {
          const suggested = roundNice(Math.min(projected * 1.05, mv.foodBudget * 1.25));
          if (suggested > mv.foodBudget) {
            push({
              type: 'increase',
              target: 'food',
              targetId: 'food',
              targetName: 'Alimentación',
              emoji: '🍽️',
              priority: foodPriority,
              currentMonthly: mv.foodBudget,
              currentWeekly: mv.foodBudget / 4.33,
              suggestedMonthly: suggested,
              suggestedWeekly: suggested / 4.33,
              reason: `Vas a un ritmo de ~${projected.toFixed(0)}€/mes en comida (prioridad ${this.getPriorityMeta(foodPriority).label}). Conviene subir el presupuesto para no forzar el plan.`,
              impact: `+${(suggested - mv.foodBudget).toFixed(0)}€/mes · +${((suggested - mv.foodBudget) / 4.33).toFixed(1)}€/sem`,
              level: 'warn',
            });
          }
        } else {
          const suggested = roundNice(Math.max(mv.foodBudget * 0.9, projected * 0.85));
          if (suggested < mv.foodBudget) {
            push({
              type: 'decrease',
              target: 'food',
              targetId: 'food',
              targetName: 'Alimentación',
              emoji: '🍽️',
              priority: foodPriority,
              currentMonthly: mv.foodBudget,
              currentWeekly: mv.foodBudget / 4.33,
              suggestedMonthly: suggested,
              suggestedWeekly: suggested / 4.33,
              reason: `Comida por encima del plan y prioridad ${this.getPriorityMeta(foodPriority).label}. Baja el presupuesto y controla el gasto real.`,
              impact: `-${(mv.foodBudget - suggested).toFixed(0)}€/mes · -${((mv.foodBudget - suggested) / 4.33).toFixed(1)}€/sem`,
              level: 'danger',
            });
          }
        }
      } else if (overPct < 0.7 && mv.dayOfMonth >= 10 && foodPriority >= 3) {
        const suggested = roundNice(Math.max(projected * 1.1, mv.foodBudget * 0.85));
        if (suggested < mv.foodBudget - 5) {
          push({
            type: 'decrease',
            target: 'food',
            targetId: 'food',
            targetName: 'Alimentación',
            emoji: '🍽️',
            priority: foodPriority,
            currentMonthly: mv.foodBudget,
            currentWeekly: mv.foodBudget / 4.33,
            suggestedMonthly: suggested,
            suggestedWeekly: suggested / 4.33,
            reason: `Llevas ${(overPct * 100).toFixed(0)}% del presupuesto de comida a este ritmo. Puedes liberar margen para ahorro u otras prioridades.`,
            impact: `Libera ${(mv.foodBudget - suggested).toFixed(0)}€/mes`,
            level: 'info',
          });
        }
      }
    }

    // ── Category groups ───────────────────────────────────────────────────
    for (const g of monthSum.byGroup) {
      if (g.isFoodGroup || g.monthlyBudget <= 0) continue;
      const projected = frac > 0 ? g.spent / frac : g.spent;
      const overPct = g.monthlyBudget > 0 ? projected / g.monthlyBudget : 0;
      const pMeta = this.getPriorityMeta(g.priority);

      if (overPct > 1.1) {
        if (g.priority <= 2) {
          const suggested = roundNice(Math.min(projected * 1.05, g.monthlyBudget * 1.3));
          if (suggested > g.monthlyBudget) {
            push({
              type: 'increase',
              target: 'group',
              targetId: g.id,
              targetName: g.name,
              emoji: g.emoji,
              priority: g.priority,
              currentMonthly: g.monthlyBudget,
              currentWeekly: g.weeklyBudget,
              suggestedMonthly: suggested,
              suggestedWeekly: suggested / 4.33,
              reason: `${g.name} es prioridad ${pMeta.label} y vas a ~${projected.toFixed(0)}€/mes. Sube el presupuesto del grupo.`,
              impact: `+${(suggested - g.monthlyBudget).toFixed(0)}€/mes · +${((suggested - g.monthlyBudget) / 4.33).toFixed(1)}€/sem`,
              level: 'warn',
            });
          }
        } else {
          const cutFactor = g.priority >= 5 ? 0.75 : g.priority >= 4 ? 0.85 : 0.9;
          const suggested = roundNice(Math.max(g.monthlyBudget * cutFactor, projected * 0.8));
          // Prefer cutting budget when low priority overspending
          const weekSpent = weekSum.byGroup.find(x => x.id === g.id)?.spent || 0;
          const suggestedWeekly = roundNice(Math.max(0, Math.min(g.weeklyBudget * cutFactor, weekSpent > 0 ? weekSpent * 0.85 : g.weeklyBudget * cutFactor)));
          push({
            type: 'decrease',
            target: 'group',
            targetId: g.id,
            targetName: g.name,
            emoji: g.emoji,
            priority: g.priority,
            currentMonthly: g.monthlyBudget,
            currentWeekly: g.weeklyBudget,
            suggestedMonthly: Math.min(suggested, suggestedWeekly * 4.33),
            suggestedWeekly: Math.min(suggested, suggestedWeekly * 4.33) / 4.33,
            reason: `${g.name} (prioridad ${pMeta.label}) supera el plan. Es de los primeros sitios a ajustar.`,
            impact: `-${(g.monthlyBudget - Math.min(suggested, suggestedWeekly * 4.33)).toFixed(0)}€/mes`,
            level: g.priority >= 4 ? 'danger' : 'warn',
          });
        }
      } else if (overPct < 0.55 && mv.dayOfMonth >= 12 && g.priority >= 4) {
        const suggested = roundNice(Math.max(projected * 1.15, g.monthlyBudget * 0.7));
        if (suggested < g.monthlyBudget - 5) {
          push({
            type: 'decrease',
            target: 'group',
            targetId: g.id,
            targetName: g.name,
            emoji: g.emoji,
            priority: g.priority,
            currentMonthly: g.monthlyBudget,
            currentWeekly: g.weeklyBudget,
            suggestedMonthly: suggested,
            suggestedWeekly: suggested / 4.33,
            reason: `Poco uso de ${g.name} (prioridad ${pMeta.label}). Baja el presupuesto y reasigna a ahorro o a gastos esenciales.`,
            impact: `Libera ${(g.monthlyBudget - suggested).toFixed(0)}€/mes`,
            level: 'info',
          });
        }
      }
    }

    // ── Weekly category limits ────────────────────────────────────────────
    const weekExpenses = this.getWeekSpendableExpenses();
    const limits = Store.getCategoryLimits();
    for (const [cat, limit] of Object.entries(limits)) {
      if (!(limit > 0)) continue;
      const spent = weekExpenses.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0);
      const priority = Store.getCategoryPriority(cat);
      const pMeta = this.getPriorityMeta(priority);
      const weekFrac = Math.max(0.2, (7 - this.calcWeekly().daysLeft) / 7);
      const projectedWeek = spent / weekFrac;

      if (projectedWeek > limit * 1.15) {
        if (priority <= 2) {
          const suggested = roundNice(Math.min(projectedWeek * 1.05, limit * 1.35));
          if (suggested > limit) {
            push({
              type: 'increase',
              target: 'category',
              targetId: cat,
              targetName: cat,
              emoji: '🏷️',
              priority,
              currentMonthly: limit * 4.33,
              currentWeekly: limit,
              suggestedMonthly: suggested * 4.33,
              suggestedWeekly: suggested,
              reason: `${cat} es prioridad ${pMeta.label} y vas a ~${projectedWeek.toFixed(0)}€ esta semana. Sube el límite semanal.`,
              impact: `+${(suggested - limit).toFixed(0)}€/sem · +${((suggested - limit) * 4.33).toFixed(0)}€/mes`,
              level: 'warn',
            });
          }
        } else {
          const cut = priority >= 5 ? 0.7 : priority >= 4 ? 0.8 : 0.85;
          const suggested = roundNice(limit * cut);
          if (suggested < limit) {
            push({
              type: 'decrease',
              target: 'category',
              targetId: cat,
              targetName: cat,
              emoji: '🏷️',
              priority,
              currentMonthly: limit * 4.33,
              currentWeekly: limit,
              suggestedMonthly: suggested * 4.33,
              suggestedWeekly: suggested,
              reason: `${cat} (prioridad ${pMeta.label}) se está disparando. Baja el límite semanal para frenar el gasto.`,
              impact: `-${(limit - suggested).toFixed(0)}€/sem · -${((limit - suggested) * 4.33).toFixed(0)}€/mes`,
              level: priority >= 4 ? 'danger' : 'warn',
            });
          }
        }
      } else if (spent > 0 && spent <= limit * 0.35 && priority >= 4 && this.calcWeekly().daysLeft <= 3) {
        const suggested = roundNice(Math.max(spent + 2, limit * 0.6));
        if (suggested < limit - 2) {
          push({
            type: 'decrease',
            target: 'category',
            targetId: cat,
            targetName: cat,
            emoji: '🏷️',
            priority,
            currentMonthly: limit * 4.33,
            currentWeekly: limit,
            suggestedMonthly: suggested * 4.33,
            suggestedWeekly: suggested,
            reason: `${cat} (prioridad ${pMeta.label}) casi no se ha usado. Puedes bajar el límite y ganar margen semanal.`,
            impact: `Libera ${(limit - suggested).toFixed(0)}€/sem`,
            level: 'info',
          });
        }
      }
    }

    // ── Imprevistos ───────────────────────────────────────────────────────
    if (mv.imprevistosBudget > 0) {
      const projected = frac > 0 ? mv.imprevistosSpent / frac : mv.imprevistosSpent;
      const priority = Store.getExpensePriority('__imprevistos__', 2);
      if (projected > mv.imprevistosBudget * 1.1 && priority <= 2) {
        const suggested = roundNice(Math.min(projected * 1.1, mv.imprevistosBudget * 1.4));
        if (suggested > mv.imprevistosBudget) {
          push({
            type: 'increase',
            target: 'imprevistos',
            targetId: '__imprevistos__',
            targetName: 'Imprevistos',
            emoji: '⚠️',
            priority,
            currentMonthly: mv.imprevistosBudget,
            currentWeekly: mv.imprevistosBudget / 4.33,
            suggestedMonthly: suggested,
            suggestedWeekly: suggested / 4.33,
            reason: 'Los imprevistos van por encima del fondo. Sube la reserva para no tocar el ahorro.',
            impact: `+${(suggested - mv.imprevistosBudget).toFixed(0)}€/mes`,
            level: 'warn',
          });
        }
      }
    }

    // ── Global rebalance tip when overspending month pace ─────────────────
    if (mv.projectedMonthTotal > mv.monthlyIncome * 0.95) {
      const lowPriCuts = recommendations
        .filter(r => r.type === 'decrease' && r.priority >= 4)
        .reduce((s, r) => s + Math.max(0, r.currentMonthly - r.suggestedMonthly), 0);
      if (lowPriCuts > 0) {
        push({
          type: 'reallocate',
          target: 'plan',
          targetId: 'plan',
          targetName: 'Reequilibrio general',
          emoji: '⚖️',
          priority: 5,
          currentMonthly: mv.projectedMonthTotal,
          currentWeekly: mv.projectedMonthTotal / 4.33,
          suggestedMonthly: mv.monthlyIncome * 0.9,
          suggestedWeekly: (mv.monthlyIncome * 0.9) / 4.33,
          reason: `Al ritmo actual proyectas ${mv.projectedMonthTotal.toFixed(0)}€ de gasto vs ${mv.monthlyIncome.toFixed(0)}€ de ingreso. Aplicar los recortes de prioridad baja libera ~${lowPriCuts.toFixed(0)}€/mes.`,
          impact: `Objetivo: gastar ≤ ${(mv.monthlyIncome * 0.9).toFixed(0)}€/mes`,
          level: 'danger',
          applyAllLowPriority: true,
        });
      }
    }

    // Sort: danger first, then by priority (cut low-pri first / protect high)
    const levelOrder = { danger: 0, warn: 1, info: 2, good: 3 };
    recommendations.sort((a, b) =>
      (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9) ||
      (b.type === 'decrease' ? b.priority - a.priority : a.priority - b.priority)
    );

    return {
      week: weekSum,
      month: monthSum,
      recommendations: recommendations.slice(0, 12),
      hasPrioritiesConfigured: Object.keys(Store.getExpensePriorities()).length > 0,
    };
  },

  /** Aplica una recomendación sobre el presupuesto real */
  applyRecommendation(rec) {
    if (!rec) return false;
    if (rec.applyAllLowPriority) {
      const pack = this.getBudgetRecommendations();
      let n = 0;
      for (const r of pack.recommendations) {
        if (r.type === 'decrease' && r.priority >= 4 && !r.applyAllLowPriority) {
          if (this.applyRecommendation(r)) n++;
        }
      }
      return n > 0;
    }
    const monthly = Math.max(0, Number(rec.suggestedMonthly) || 0);
    const weekly = Math.max(0, Number(rec.suggestedWeekly) || 0);
    if (rec.target === 'food') {
      Store.setFoodBudget(monthly);
      return true;
    }
    if (rec.target === 'group') {
      Store.updateCategoryGroup(rec.targetId, { monthlyBudget: monthly });
      return true;
    }
    if (rec.target === 'category') {
      Store.setCategoryLimit(rec.targetId, weekly);
      return true;
    }
    if (rec.target === 'imprevistos') {
      Store.setImprevistosBudget(monthly);
      return true;
    }
    return false;
  },

  // ── Alerta de límite semanal ──────────────────────────────────────────────

  /**
   * Devuelve alerta para una categoría dado un importe que se va a añadir.
   * Usa la semana actual como periodo (igual que el plan).
   */
  checkCategoryLimit(category, newAmount) {
    const limits = Store.getCategoryLimits();
    const weekExpenses = this.getWeekSpendableExpenses();

    // Check individual category limit
    const catLimit = limits[category];
    const catSpent = weekExpenses.filter(t => t.category === category).reduce((s, t) => s + t.amount, 0);

    // Check group limit if category belongs to a group with monthlyBudget
    const group = Store.getCategoryGroup(category);
    const groupWeekLimit = group && group.monthlyBudget > 0 ? group.monthlyBudget / 4.33 : null;
    const groupSpent = group ? weekExpenses.filter(t => group.categories.includes(t.category)).reduce((s, t) => s + t.amount, 0) : 0;

    if (!catLimit && !groupWeekLimit) return null;

    // Use category limit if set, otherwise group weekly limit
    const limit = catLimit > 0 ? catLimit : groupWeekLimit;
    const alreadySpent = catLimit > 0 ? catSpent : groupSpent;
    const groupInfo = !catLimit && group ? { groupName: group.name, groupTotal: groupSpent } : null;

    const projected = alreadySpent + (newAmount || 0);
    const pct = (projected / limit) * 100;
    const level = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : pct >= 50 ? 'caution' : 'good';
    return { limit, alreadySpent, projected, pct, level, groupInfo };
  },
};
