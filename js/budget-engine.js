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
    return Store.getTransactions()
      .filter(t => t.month === m && Store.isFoodCategory(t.category) && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  /** Gastos de imprevistos del mes (categoría exacta 'Imprevisto') */
  getMonthImprevistosSpending(month) {
    const m = month || Store.getCurrentMonth();
    return Store.getTransactions()
      .filter(t => t.month === m && t.category === 'Imprevisto' && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  // ── Ingresos configurados / inferidos ─────────────────────────────────────

  getHistoricalStats() {
    const archives = Store.getArchives();
    const currentTx = Store.getTransactions().filter(t => !Store.isAdjustment(t));
    const byMonthExpense = {};
    const byMonthIncome = {};
    const allExpenses = [];
    const allIncomes = [];

    for (const t of currentTx) {
      if (Store.isSpendableExpense(t)) {
        allExpenses.push(t);
        byMonthExpense[t.month] = (byMonthExpense[t.month] || 0) + t.amount;
      } else if (t.type === 'Ingreso') {
        allIncomes.push(t);
        byMonthIncome[t.month] = (byMonthIncome[t.month] || 0) + t.amount;
      }
    }
    for (const [month, txs] of Object.entries(archives)) {
      for (const t of txs) {
        if (Store.isAdjustment(t)) continue;
        if (Store.isSpendableExpense(t)) {
          allExpenses.push(t);
          byMonthExpense[month] = (byMonthExpense[month] || 0) + t.amount;
        } else if (t.type === 'Ingreso') {
          allIncomes.push(t);
          byMonthIncome[month] = (byMonthIncome[month] || 0) + t.amount;
        }
      }
    }

    const expenseMonths = Object.keys(byMonthExpense).sort();
    const incomeMonths = Object.keys(byMonthIncome).sort();
    const allMonths = [...new Set([...expenseMonths, ...incomeMonths])].sort();
    const numExpenseMonths = Math.max(expenseMonths.length, 0);
    const numIncomeMonths = Math.max(incomeMonths.length, 0);

    const totalExpense = Object.values(byMonthExpense).reduce((s, v) => s + v, 0);
    const totalIncome = Object.values(byMonthIncome).reduce((s, v) => s + v, 0);
    const avgMonthlyExpense = numExpenseMonths > 0 ? totalExpense / numExpenseMonths : 0;
    const avgMonthlyIncome = numIncomeMonths > 0 ? totalIncome / numIncomeMonths : 0;

    const byCat = {};
    for (const t of allExpenses) {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    }
    const catAvg = {};
    const catDiv = Math.max(numExpenseMonths, 1);
    for (const [cat, total] of Object.entries(byCat)) {
      catAvg[cat] = total / catDiv;
    }

    const groupAvg = {};
    for (const g of Store.getCategoryGroups()) {
      let total = 0;
      for (const t of allExpenses) {
        if (Store.txInCategoryGroup(t, g)) total += t.amount;
      }
      if (total > 0) {
        groupAvg[g.id] = {
          id: g.id,
          name: g.name,
          emoji: Store.getGroupDisplayEmoji(g),
          monthly: total / catDiv,
          isFoodGroup: !!g.isFoodGroup,
        };
      }
    }

    let confidence = 'none';
    if (allMonths.length >= 3 && (avgMonthlyIncome > 0 || avgMonthlyExpense > 0)) confidence = 'high';
    else if (allMonths.length >= 2) confidence = 'medium';
    else if (allMonths.length >= 1 && (totalExpense > 0 || totalIncome > 0)) confidence = 'low';

    return {
      avgMonthlyExpense,
      avgWeeklyExpense: avgMonthlyExpense / 4.33,
      avgDailyExpense: avgMonthlyExpense / 30,
      avgMonthlyIncome,
      avgWeeklyIncome: avgMonthlyIncome / 4.33,
      numMonths: allMonths.length,
      numExpenseMonths,
      numIncomeMonths,
      byMonthExpense,
      byMonthIncome,
      catAvg,
      groupAvg,
      confidence,
      allMonths,
    };
  },

  getInferredIncome() {
    const stats = this.getHistoricalStats();
    if (stats.avgMonthlyIncome > 0) {
      return {
        weekly: stats.avgWeeklyIncome,
        monthly: stats.avgMonthlyIncome,
        source: 'history',
        confidence: stats.confidence,
        label: 'Estimado de tus ingresos registrados',
      };
    }
    if (stats.avgMonthlyExpense > 0) {
      const monthly = stats.avgMonthlyExpense * 1.05;
      return {
        weekly: monthly / 4.33,
        monthly,
        source: 'expense_estimate',
        confidence: stats.confidence === 'none' ? 'low' : stats.confidence,
        label: 'Estimado a partir de tu gasto habitual (+5%)',
      };
    }
    return { weekly: 0, monthly: 0, source: 'none', confidence: 'none', label: 'Sin datos suficientes' };
  },

  getEffectiveIncome() {
    const mode = Store.getIncomeMode();
    const manualWeekly = Store.getBudgetWeeklyIncome();
    const manualExtra = Store.getBudgetMonthlyExtra();
    const manualMonthly = Store.isIncomeUserSet() ? (manualWeekly * 4.33 + manualExtra) : 0;
    const inferred = this.getInferredIncome();

    let monthly = 0;
    let source = 'none';
    let sourceLabel = inferred.label;

    if (mode === 'manual') {
      monthly = manualMonthly;
      source = manualMonthly > 0 ? 'manual' : 'none';
      sourceLabel = manualMonthly > 0 ? 'Configurado en Ajustes' : inferred.label;
    } else if (mode === 'auto') {
      monthly = inferred.monthly;
      source = inferred.source;
      sourceLabel = inferred.label;
    } else {
      monthly = Math.max(manualMonthly, inferred.monthly);
      if (manualMonthly >= inferred.monthly && manualMonthly > 0) {
        source = 'manual';
        sourceLabel = inferred.monthly > 0
          ? 'Híbrido: usa tu configuración (mayor que el histórico)'
          : 'Configurado en Ajustes';
      } else if (inferred.monthly > manualMonthly) {
        source = inferred.source;
        sourceLabel = manualMonthly > 0
          ? `Híbrido: histórico (${inferred.monthly.toFixed(0)}€/mes) supera lo configurado`
          : inferred.label;
      }
    }

    return {
      weekly: monthly / 4.33,
      monthly,
      manualMonthly,
      inferredMonthly: inferred.monthly,
      source,
      sourceLabel,
      confidence: inferred.confidence,
      mode,
      hasManual: manualMonthly > 0,
      hasInferred: inferred.monthly > 0,
    };
  },

  getWeeklyIncome() {
    return this.getEffectiveIncome().weekly;
  },

  _roundNice(n) {
    if (n <= 0) return 0;
    if (n < 20) return Math.round(n);
    if (n < 100) return Math.round(n / 5) * 5;
    return Math.round(n / 10) * 10;
  },

  getLearnedBudgetSuggestions() {
    const stats = this.getHistoricalStats();
    const income = this.getEffectiveIncome();
    const suggestions = [];
    let rid = 0;

    const push = (rec) => suggestions.push({ id: 'learn_' + (++rid), fromHistory: true, ...rec });

    const suggestedMonthlyGlobal = income.monthly > 0
      ? income.monthly
      : (stats.avgMonthlyExpense > 0 ? stats.avgMonthlyExpense * 1.05 : 0);
    const suggestedWeeklyGlobal = suggestedMonthlyGlobal / 4.33;

    for (const g of Object.values(stats.groupAvg)) {
      const group = Store.getCategoryGroups().find(x => x.id === g.id);
      if (!group) continue;
      const current = group.isFoodGroup ? Store.getEffectiveFoodBudget() : (group.monthlyBudget || 0);
      const historical = g.monthly;
      if (historical <= 0) continue;

      const suggested = this._roundNice(historical * 1.05);
      const diffPct = current > 0 ? Math.abs(current - historical) / historical : 1;

      if (current <= 0 || diffPct > 0.25) {
        push({
          type: current <= 0 ? 'setup' : 'adjust',
          target: group.isFoodGroup ? 'food' : 'group',
          targetId: group.isFoodGroup ? 'food' : g.id,
          targetName: g.name,
          emoji: g.emoji || '📦',
          priority: Store.getGroupPriority(g.id),
          currentMonthly: current,
          currentWeekly: current / 4.33,
          suggestedMonthly: suggested,
          suggestedWeekly: suggested / 4.33,
          reason: current <= 0
            ? `Según ${stats.numExpenseMonths || 1} mes(es) de movimientos, gastas ~${historical.toFixed(0)}€/mes en ${g.name}.`
            : `Tu presupuesto (${current.toFixed(0)}€/mes) difiere del histórico (~${historical.toFixed(0)}€/mes).`,
          impact: `${suggested.toFixed(0)}€/mes · ${(suggested / 4.33).toFixed(1)}€/sem sugeridos`,
          level: current <= 0 ? 'info' : 'warn',
        });
      }
    }

    const limits = Store.getCategoryLimits();
    for (const [cat, avg] of Object.entries(stats.catAvg)) {
      if (avg < 8) continue;
      if (Store.getCategoryGroup(cat)) continue;
      const limit = limits[cat] || 0;
      if (limit > 0) continue;
      const suggestedWeekly = this._roundNice(avg / 4.33);
      push({
        type: 'setup',
        target: 'category',
        targetId: cat,
        targetName: cat,
        emoji: '🏷️',
        priority: Store.getCategoryPriority(cat),
        currentMonthly: 0,
        currentWeekly: 0,
        suggestedMonthly: suggestedWeekly * 4.33,
        suggestedWeekly,
        reason: `Gastas ~${avg.toFixed(0)}€/mes en ${cat} sin límite semanal definido.`,
        impact: `${suggestedWeekly.toFixed(0)}€/sem sugerido`,
        level: 'info',
      });
    }

    return {
      stats,
      income,
      global: {
        suggestedMonthly: suggestedMonthlyGlobal,
        suggestedWeekly: suggestedWeeklyGlobal,
      },
      suggestions: suggestions.slice(0, 10),
      confidence: stats.confidence,
    };
  },

  // ── Allocaciones del plan ─────────────────────────────────────────────────

  getAllocations() {
    const goals = Store.getSavingGoals();
    const foodWeekly           = Store.getEffectiveFoodBudget() / 4.33;
    const savingWeekly         = Store.getRecommendedWeeklySaving(goals);
    const plannedExpWeekly     = Store.getPlannedExpensesWeeklyNeed();
    const imprevistosWeekly    = Store.getEffectiveImprevistosBudget() / 4.33;
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
    const imprevistosBudget = Store.getEffectiveImprevistosBudget();
    const limits = Store.getCategoryLimits();

    const expenses = this.getMonthSpendableExpenses(m);
    const foodSpent = expenses
      .filter(t => Store.isFoodCategory(t.category))
      .reduce((s, t) => s + t.amount, 0);
    const imprevistosSpent = expenses
      .filter(t => t.category === 'Imprevisto')
      .reduce((s, t) => s + t.amount, 0);
    const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);

    // Monthly income (effective: manual / inferred / hybrid)
    const monthlyIncome = this.getEffectiveIncome().monthly;

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
      .filter(t => Store.txInCategoryGroup(t, group))
      .reduce((s, t) => s + t.amount, 0);
  },

  /** Returns month spending total for categories in a given group */
  getGroupMonthSpending(groupId, month) {
    const groups = Store.getCategoryGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return 0;
    const m = month || Store.getCurrentMonth();
    return Store.getTransactions()
      .filter(t => t.month === m && Store.txInCategoryGroup(t, group) && Store.isSpendableExpense(t))
      .reduce((s, t) => s + t.amount, 0);
  },

  // ── Guía de ahorro inteligente ────────────────────────────────────────────

  /**
   * Calcula la guía de ahorro recomendada según el ingreso mensual.
   * Devuelve porcentajes y cantidades semanales/mensuales recomendados.
   */
  getSmartSavingsGuide() {
    const effective = this.getEffectiveIncome();
    const monthlyIncome = effective.monthly;

    if (monthlyIncome <= 0) {
      const stats = this.getHistoricalStats();
      return {
        monthlyIncome: 0,
        incomeSource: effective.source,
        incomeSourceLabel: effective.sourceLabel,
        savingPct: 10,
        imprevistosPct: 10,
        label: 'Aprendiendo de tus movimientos',
        color: '#6366F1',
        advice: stats.avgMonthlyExpense > 0
          ? `Sin ingresos definidos aún. Gastas ~${stats.avgMonthlyExpense.toFixed(0)}€/mes de media — registra ingresos o configúralos en ⚙️ para un plan más preciso.`
          : 'Empieza registrando gastos e ingresos. No hace falta configurar nada: la app aprenderá tu ritmo automáticamente.',
        monthlySaving: 0,
        monthlyImprevisto: 0,
        weeklySaving: 0,
        weeklyImprevisto: 0,
        currentWeeklySaving: Store.getRecommendedWeeklySaving(Store.getSavingGoals()),
        currentImprevistosBudget: Store.getEffectiveImprevistosBudget(),
        imprevistosInPlan: Store.isImprevistosInPlan(),
        imprevistosAutoAdjust: Store.isImprevistosAutoAdjust(),
      };
    }

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
    const currentImprevistosBudget = Store.getEffectiveImprevistosBudget();
    const imprevistosInPlan = Store.isImprevistosInPlan();

    return {
      monthlyIncome,
      incomeSource: effective.source,
      incomeSourceLabel: effective.sourceLabel,
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
      imprevistosInPlan,
      imprevistosAutoAdjust: Store.isImprevistosAutoAdjust(),
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
    const monthlyIncome = this.getEffectiveIncome().monthly;

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
    const currentMonth = Store.getCurrentMonth();
    const monthExpenses = this.getMonthSpendableExpenses(currentMonth);

    const usedCats = new Set(monthExpenses.map(t => t.category));
    const uncategorized = [];
    for (const cat of usedCats) {
      if (!Store.getCategoryGroup(cat)) {
        const total = monthExpenses.filter(t => Store._categoryKeysMatch(t.category, cat)).reduce((s, t) => s + t.amount, 0);
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
    const effective = this.getEffectiveIncome();
    const weeklyIncomeCfg = effective.weekly;
    const incomeConfigured = isWeek ? weeklyIncomeCfg : effective.monthly;

    const byCatMap = {};
    for (const t of expenses) {
      byCatMap[t.category] = (byCatMap[t.category] || 0) + t.amount;
    }

    const groups = Store.getCategoryGroups();
    const limits = Store.getCategoryLimits();
    const byGroup = groups.map(g => {
      const spent = expenses
        .filter(t => Store.txInCategoryGroup(t, g))
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

    const byCategory = Object.entries(byCatMap)
      .filter(([name]) => !Store.getCategoryGroup(name))
      .map(([name, spent]) => {
        const limit = limits[name] || 0;
        const budget = isWeek ? limit : limit * 4.33;
        return {
          name,
          spent,
          budget,
          weeklyLimit: limit,
          inGroup: false,
          groupName: null,
          isFood: Store.isFoodCategory(name),
          priority: Store.getCategoryPriority(name),
          pct: budget > 0 ? (spent / budget) * 100 : 0,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const incomeGroups = Store.getIncomeGroups();
    const byIncomeGroup = incomeGroups.map(g => {
      const received = incomes
        .filter(t => Store.txInIncomeGroup(t, g))
        .reduce((s, t) => s + t.amount, 0);
      const target = g.monthlyTarget || 0;
      const targetPeriod = isWeek ? target / 4.33 : target;
      return {
        id: g.id,
        name: g.name,
        emoji: Store.getGroupDisplayEmoji(g, true),
        received,
        target: targetPeriod,
        monthlyTarget: target,
        pct: targetPeriod > 0 ? (received / targetPeriod) * 100 : 0,
      };
    }).filter(g => g.received > 0 || g.target > 0)
      .sort((a, b) => b.received - a.received);

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
      byIncomeGroup,
      byIncomeCat,
      topExpenses: byCategory.slice(0, 6),
      ungroupedExpenses: byCategory.filter(c => !c.inGroup && c.spent > 0),
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
    const learned = this.getLearnedBudgetSuggestions();
    const frac = mv.daysInMonth > 0 ? Math.max(0.15, mv.dayOfMonth / mv.daysInMonth) : 1;
    const recommendations = [];
    let rid = 0;

    const push = (rec) => {
      recommendations.push({ id: 'rec_' + (++rid), ...rec });
    };

    const roundNice = (n) => this._roundNice(n);

    // Historical baseline suggestions when budgets are missing or far from reality
    for (const ls of learned.suggestions) {
      push(ls);
    }

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

    // ── Weekly category limits (solo categorías sueltas, sin grupo) ─────────
    const weekExpenses = this.getWeekSpendableExpenses();
    const limits = Store.getUngroupedCategoryLimits();
    for (const [cat, limit] of Object.entries(limits)) {
      if (!(limit > 0)) continue;
      const spent = weekExpenses.filter(t => Store._categoryKeysMatch(t.category, cat)).reduce((s, t) => s + t.amount, 0);
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
    if (Store.isImprevistosInPlan() && mv.imprevistosBudget > 0) {
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
    const deduped = [];
    const seenTargets = new Set();
    for (const r of recommendations) {
      const key = `${r.target}:${r.targetId}`;
      if (seenTargets.has(key)) continue;
      seenTargets.add(key);
      deduped.push(r);
    }
    deduped.sort((a, b) =>
      (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9) ||
      (b.type === 'decrease' ? b.priority - a.priority : a.priority - b.priority)
    );

    return {
      week: weekSum,
      month: monthSum,
      learned,
      recommendations: deduped.slice(0, 14),
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
      if (!Store.isImprevistosInPlan()) Store.enableImprevistosInPlan({ autoAdjust: true });
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
    const group = Store.getCategoryGroup(category);
    const weekExpenses = this.getWeekSpendableExpenses();

    if (group && group.monthlyBudget > 0) {
      const groupWeekLimit = group.monthlyBudget / 4.33;
      const groupSpent = weekExpenses.filter(t => Store.txInCategoryGroup(t, group)).reduce((s, t) => s + t.amount, 0);
      const projected = groupSpent + (newAmount || 0);
      const pct = (projected / groupWeekLimit) * 100;
      const level = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : pct >= 50 ? 'caution' : 'good';
      return {
        limit: groupWeekLimit,
        alreadySpent: groupSpent,
        projected,
        pct,
        level,
        groupInfo: { groupName: group.name, groupTotal: groupSpent },
        isGroup: true,
      };
    }

    const limits = Store.getUngroupedCategoryLimits();
    const catLimit = limits[category];
    if (!(catLimit > 0)) return null;

    const catSpent = weekExpenses.filter(t => Store._categoryKeysMatch(t.category, category)).reduce((s, t) => s + t.amount, 0);
    const projected = catSpent + (newAmount || 0);
    const pct = (projected / catLimit) * 100;
    const level = pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : pct >= 50 ? 'caution' : 'good';
    return { limit: catLimit, alreadySpent: catSpent, projected, pct, level, groupInfo: null, isGroup: false };
  },
};
