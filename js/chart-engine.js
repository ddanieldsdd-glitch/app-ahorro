/**
 * ChartEngine — motor puro de gráficos Chart.js (sin DOM de dashboard).
 */
const ChartEngine = {
  resolveRange(mode, viewMonth) {
    const now = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start;
    const [vy, vm] = (viewMonth || App.getCurrentViewMonth()).split('-').map(Number);

    if (mode === 'week') {
      const dow = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      start = new Date(now);
      start.setDate(now.getDate() + diff);
      start.setHours(0, 0, 0, 0);
    } else if (mode === 'quarter') {
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
    } else if (mode === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (mode === 'all') {
      start = new Date(2020, 0, 1);
    } else {
      start = new Date(vy, vm - 1, 1);
      end = new Date(vy, vm, 0, 23, 59, 59, 999);
    }
    return { start, end, days: Math.ceil((end - start) / 86400000) };
  },

  filterTransactions(range) {
    return Store.getTransactionsForRange(range.start, range.end);
  },

  computeStats(tx, range) {
    const checkingBalance = Store.getCheckingBalance();
    const checkingTracked = checkingBalance !== null && checkingBalance !== undefined;
    const income = checkingTracked
      ? Store.sumCheckingInflow(tx)
      : tx.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const expense = checkingTracked
      ? Store.sumCheckingOutflow(tx)
      : tx.filter(t => Store.isSpendableExpense(t)).reduce((s, t) => s + t.amount, 0);
    const traspasos = tx
      .filter(t => Store.isTraspaso(t) && (t.transferType || 'to_savings') === 'to_savings')
      .reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const savingsBalance = Store.getSavingsBalance();
    const cashBalance = Store.getCashBalance();
    const days = Math.max(1, Math.ceil((range.end - range.start) / 86400000));
    return { income, expense, balance, traspasos, checkingBalance, savingsBalance, cashBalance, days };
  },

  normalizeConfig(config) {
    const c = { ...config };
    if (!c.metrics || !c.metrics.length) c.metrics = ['expense'];
    if (!c.range) c.range = 'month';
    if (!c.group) c.group = 'category';
    if (!c.type) c.type = 'bar';
    if (!c.saldoView) c.saldoView = 'none';
    c.cumulative = !!c.cumulative;
    c.budgetVsActual = !!c.budgetVsActual;
    return c;
  },

  buildChart(canvas, rawConfig) {
    if (!canvas) return null;
    const config = this.normalizeConfig(rawConfig);
    const range = this.resolveRange(config.range);
    let group = config.group;
    const type = config.type;
    const isPie = type === 'pie' || type === 'doughnut';
    const isArea = type === 'area';
    const filtered = this.filterTransactions(range);

    if (range.days > 93 && group === 'day') group = 'week';
    if (range.days > 365 && group === 'week') group = 'month';

    if (filtered.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return { chart: null, range, count: 0, group };
    }

    let chart = null;
    if (isPie) {
      chart = this._renderPie(canvas, filtered, type, config.metrics, group);
    } else if (config.budgetVsActual && group === 'category') {
      chart = this._renderBudgetVsActual(canvas, filtered, range);
    } else if (config.budgetVsActual && group === 'group') {
      chart = this._renderGroupBudgetVsActual(canvas, filtered, range);
    } else {
      chart = this._renderBars(
        canvas, filtered, isArea ? 'line' : type, config.metrics, group,
        config.cumulative, range, isArea, config.saldoView
      );
    }
    return { chart, range, count: filtered.length, group };
  },

  destroyChart(chart) {
    if (chart) chart.destroy();
  },

  _aggregate(tx, group) {
    const map = {};
    tx.forEach(t => {
      const isIncome = t.type === 'Ingreso';
      let key;
      const d = new Date(t.date + 'T00:00:00');
      if (group === 'day') key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      else if (group === 'week') {
        const dow = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
        key = `Sem ${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
      } else if (group === 'month') key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      else if (group === 'category') key = t.category || 'Otros';
      else if (group === 'group') {
        const g = Store.getCategoryGroup(t.category);
        key = g ? ((g.emoji ? g.emoji + ' ' : '') + g.name) : '📦 Sin grupo';
      } else key = t.paymentMethod || 'Sin método';

      if (!map[key]) map[key] = { income: 0, expense: 0, savings: 0 };
      if (isIncome) map[key].income += t.amount;
      else if (Store.isSpendableExpense(t)) map[key].expense += t.amount;
      else if (Store.isTraspaso(t) && (t.transferType || 'to_savings') === 'to_savings') {
        map[key].savings += t.amount;
      }
    });

    let labels;
    if (group === 'day' || group === 'week') {
      labels = Object.keys(map).sort((a, b) => {
        const ma = a.startsWith('Sem ') ? a.replace('Sem ', '').split('/').reverse().map(Number) : a.split('/').reverse().map(Number);
        const mb = b.startsWith('Sem ') ? b.replace('Sem ', '').split('/').reverse().map(Number) : b.split('/').reverse().map(Number);
        return (ma[0] || 0) - (mb[0] || 0) || (ma[1] || 0) - (mb[1] || 0);
      });
    } else {
      labels = Object.keys(map).sort((a, b) => a.localeCompare(b));
    }

    const result = { labels, values: {} };
    labels.forEach(l => {
      result.values[l] = {
        income: map[l].income,
        expense: map[l].expense,
        savings: map[l].savings,
        balance: map[l].income - map[l].expense,
      };
    });
    return result;
  },

  _renderBars(ctx, tx, type, metrics, group, cumulative, range, isArea, saldoView) {
    const data = this._aggregate(tx, group);
    if (!data.labels.length) return null;
    const colors = {
      income: { bg: 'rgba(16,185,129,0.6)', border: '#10B981', grad: ['rgba(16,185,129,0.6)', 'rgba(16,185,129,0.05)'] },
      expense: { bg: 'rgba(239,68,68,0.6)', border: '#EF4444', grad: ['rgba(239,68,68,0.6)', 'rgba(239,68,68,0.05)'] },
      balance: { bg: 'rgba(79,70,229,0.6)', border: '#4F46E5', grad: ['rgba(79,70,229,0.6)', 'rgba(79,70,229,0.05)'] },
      savings: { bg: 'rgba(139,92,246,0.6)', border: '#8B5CF6', grad: ['rgba(139,92,246,0.6)', 'rgba(139,92,246,0.05)'] },
    };
    const names = { income: 'Ingresos', expense: 'Gastos', balance: 'Balance', savings: 'Ahorro' };
    const datasets = [];

    metrics.forEach(m => {
      let values = data.labels.map(l => data.values[l][m] || 0);
      if (cumulative) {
        let s = 0;
        values = values.map(v => { s += v; return s; });
      }
      const cfg = {
        label: names[m],
        data: values,
        backgroundColor: isArea ? this._gradient(ctx, colors[m].grad) : colors[m].bg,
        borderColor: colors[m].border,
        borderWidth: 2,
        tension: 0.35,
        fill: isArea,
        pointRadius: isArea ? 2 : 3,
        pointHoverRadius: 6,
      };
      if (type === 'bar') {
        cfg.borderRadius = 4;
        cfg.borderSkipped = false;
      }
      datasets.push(cfg);
    });

    if (saldoView && saldoView !== 'none') {
      const allTx = Store.getTransactionsForRange(new Date(2020, 0, 1), range.end);
      const checkingNow = Store.getCheckingBalance();
      if (checkingNow !== null && checkingNow !== undefined) {
        const runningChecking = this._computeRunningBalance(data, allTx, range);
        if (runningChecking) {
          const savingsBalance = Store.getSavingsBalance();
          const cashBalance = Store.getCashBalance();
          const saldoColors = {
            checking: { border: '#0EA5E9', grad: ['rgba(14,165,233,0.5)', 'rgba(14,165,233,0.05)'] },
            total_liquid: { border: '#6366F1', grad: ['rgba(99,102,241,0.5)', 'rgba(99,102,241,0.05)'] },
            total_wealth: { border: '#8B5CF6', grad: ['rgba(139,92,246,0.5)', 'rgba(139,92,246,0.05)'] },
          };
          const saldoLabels = { checking: '💳 Cuenta corriente', total_liquid: '💳+🔒 CC + Ahorro', total_wealth: '💳+🔒+💵 Total' };
          const offset = saldoView === 'total_liquid' ? savingsBalance : saldoView === 'total_wealth' ? savingsBalance + cashBalance : 0;
          const sc = saldoColors[saldoView];
          datasets.push({
            label: saldoLabels[saldoView],
            data: runningChecking.map(v => v + offset),
            backgroundColor: this._gradient(ctx, sc.grad),
            borderColor: sc.border,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            pointHoverRadius: 6,
            type: 'line',
            yAxisID: 'ySaldo',
          });
        }
      }
    }

    const hasSecondAxis = datasets.some(d => d.yAxisID === 'ySaldo');
    return new Chart(ctx, {
      type,
      data: { labels: data.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutQuart' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: datasets.length > 1, position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            titleFont: { size: 12, weight: '600' },
            bodyFont: { size: 11 },
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}€`,
            },
          },
        },
        scales: {
          y: { beginAtZero: !cumulative, ticks: { callback: v => v.toFixed(0) + '€', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
          ...(hasSecondAxis ? {
            ySaldo: {
              position: 'right',
              grid: { display: false },
              ticks: { callback: v => v.toFixed(0) + '€', font: { size: 9 }, color: '#0EA5E9' },
            },
          } : {}),
        },
      },
    });
  },

  _renderBudgetVsActual(ctx, tx, range) {
    const limits = Store.getCategoryLimits();
    const cats = Object.keys(limits);
    if (cats.length === 0) return null;

    const periodWeeks = Math.max(1, range.days / 7);
    const spent = {};
    tx.filter(t => Store.isSpendableExpense(t)).forEach(t => {
      const cat = t.category || 'Otros';
      spent[cat] = (spent[cat] || 0) + t.amount;
    });

    const labels = cats.filter(c => limits[c] > 0).sort();
    if (labels.length === 0) return null;

    const budgeted = labels.map(c => limits[c] * periodWeeks);
    const actual = labels.map(c => spent[c] || 0);
    const palette = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Presupuestado', data: budgeted, backgroundColor: 'rgba(79,70,229,0.15)', borderColor: '#4F46E5', borderWidth: 2, borderDash: [5, 5], borderRadius: 4, borderSkipped: false },
          { label: 'Real', data: actual, backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderColor: labels.map((_, i) => palette[i % palette.length]), borderWidth: 1, borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const diff = budgeted[c.dataIndex] - actual[c.dataIndex];
                const extra = c.datasetIndex === 1
                  ? (diff >= 0 ? ` (${diff.toFixed(1)}€ bajo)` : ` (${Math.abs(diff).toFixed(1)}€ sobre)`)
                  : '';
                return ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}€${extra}`;
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + '€', font: { size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
        },
      },
    });
  },

  _renderGroupBudgetVsActual(ctx, tx, range) {
    const groups = Store.getCategoryGroups();
    if (!groups.length) return null;
    const periodMonths = Math.max(1, range.days / 30);
    const spent = {};
    tx.filter(t => Store.isSpendableExpense(t)).forEach(t => {
      const g = Store.getCategoryGroup(t.category);
      const key = g ? ((g.emoji ? g.emoji + ' ' : '') + g.name) : '📦 Sin grupo';
      spent[key] = (spent[key] || 0) + t.amount;
    });

    const labels = [];
    const budgeted = [];
    const actual = [];
    groups.filter(g => g.monthlyBudget > 0 || spent[(g.emoji ? g.emoji + ' ' : '') + g.name] > 0).forEach(g => {
      const key = (g.emoji ? g.emoji + ' ' : '') + g.name;
      labels.push(key);
      budgeted.push((g.monthlyBudget || 0) * periodMonths);
      actual.push(spent[key] || 0);
    });
    if (!labels.length) return null;

    const palette = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Presupuestado', data: budgeted, backgroundColor: 'rgba(79,70,229,0.15)', borderColor: '#4F46E5', borderWidth: 2, borderRadius: 4, borderSkipped: false },
          { label: 'Real', data: actual, backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderColor: labels.map((_, i) => palette[i % palette.length]), borderWidth: 1, borderRadius: 4, borderSkipped: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 10, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const diff = budgeted[c.dataIndex] - actual[c.dataIndex];
                const extra = c.datasetIndex === 1
                  ? (diff >= 0 ? ` (${diff.toFixed(1)}€ bajo)` : ` (${Math.abs(diff).toFixed(1)}€ sobre)`)
                  : '';
                return ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}€${extra}`;
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + '€', font: { size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
        },
      },
    });
  },

  _renderPie(ctx, tx, type, metrics, group) {
    const data = this._aggregate(tx, group);
    if (!data.labels.length) return null;
    const palette = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];
    const names = { income: 'Ingreso', expense: 'Gasto', balance: 'Balance', savings: 'Ahorro' };
    const labels = [];
    const values = [];
    const bgColors = [];
    let ci = 0;

    metrics.forEach(m => {
      data.labels.forEach(l => {
        const v = data.values[l][m] || 0;
        if (v > 0) {
          labels.push(`${names[m]}: ${l}`);
          values.push(v);
          bgColors.push(palette[ci++ % palette.length]);
        }
      });
    });

    if (values.length === 0) return null;
    const total = values.reduce((s, v) => s + v, 0);

    return new Chart(ctx, {
      type,
      data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true, duration: 500 },
        cutout: type === 'doughnut' ? '55%' : 0,
        plugins: {
          legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            padding: 8,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const pct = ((c.parsed / total) * 100).toFixed(1);
                return ` ${c.label}: ${c.parsed.toFixed(2)}€ (${pct}%)`;
              },
            },
          },
        },
      },
    });
  },

  _computeRunningBalance(data, allTx, range) {
    const checkingNow = Store.getCheckingBalance();
    if (checkingNow === null || checkingNow === undefined) return null;

    const txAfterRange = allTx.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d > range.end;
    });
    let balanceAtRangeEnd = checkingNow;
    txAfterRange.forEach(t => {
      if (t.type === 'Ingreso') balanceAtRangeEnd -= t.amount;
      else if (Store.isSpendableExpense(t)) balanceAtRangeEnd += t.amount;
    });

    const labels = data.labels;
    const balances = new Array(labels.length);
    balances[labels.length - 1] = balanceAtRangeEnd;
    for (let i = labels.length - 2; i >= 0; i--) {
      const nextLabel = labels[i + 1];
      const delta = data.values[nextLabel].income - data.values[nextLabel].expense;
      balances[i] = balances[i + 1] - delta;
    }
    return balances;
  },

  _gradient(ctx, colors) {
    if (!ctx || !ctx.getContext) return colors[0];
    const c = ctx.getContext('2d');
    const { height } = c.canvas;
    const g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    return g;
  },
};
