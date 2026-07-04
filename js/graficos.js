const Graficos = {
  _chart: null,

  render() {
    const el = document.getElementById('tab-graficos');
    el.innerHTML = `
      <div class="gc-stats" id="gcStats"></div>
      <div class="card">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <button class="gc-range active" data-range="month">Este mes</button>
          <button class="gc-range" data-range="week">Esta semana</button>
          <button class="gc-range" data-range="quarter">3 meses</button>
          <button class="gc-range" data-range="year">Este año</button>
          <button class="gc-range" data-range="all">Todo</button>
        </div>
        <div class="chart-controls">
          <div class="form-group">
            <label>Agrupar</label>
            <select id="gcGroup">
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="category">Categoría</option>
              <option value="method">Método</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="gcType">
              <option value="bar">Barras</option>
              <option value="line">Línea</option>
              <option value="area">Área</option>
              <option value="pie">Circular</option>
              <option value="doughnut">Anillo</option>
            </select>
          </div>
          <div class="checkbox-group">
            <label><input type="checkbox" class="gc-metric" value="income" checked> Ingresos</label>
            <label><input type="checkbox" class="gc-metric" value="expense" checked> Gastos</label>
            <label><input type="checkbox" class="gc-metric" value="balance"> Balance</label>
            <label><input type="checkbox" class="gc-metric" value="savings"> Ahorro</label>
          </div>
          <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
            <input type="checkbox" id="gcCumulative"> Acumulado
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer" id="gcBudgetWrap">
            <input type="checkbox" id="gcBudgetVsActual"> Vs Presupuesto
          </label>
        </div>
        <div class="chart-container" id="gcChartContainer">
          <canvas id="gcChart"></canvas>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-secondary);text-align:center" id="gcInfo"></div>
      </div>
    `;

    document.querySelectorAll('.gc-range').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.gc-range').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      this._updateChart();
    }));
    document.getElementById('gcGroup').addEventListener('change', () => this._updateChart());
    document.getElementById('gcType').addEventListener('change', () => this._updateChart());
    document.querySelectorAll('.gc-metric').forEach(c => c.addEventListener('change', () => this._updateChart()));
    document.getElementById('gcCumulative').addEventListener('change', () => this._updateChart());
    document.getElementById('gcBudgetVsActual').addEventListener('change', () => this._updateChart());
    this._updateChart();
  },

  _getRange() {
    const active = document.querySelector('.gc-range.active');
    const mode = active ? active.dataset.range : 'month';
    const now = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start;
    const [vy, vm] = App.getCurrentViewMonth().split('-').map(Number);

    if (mode === 'week') {
      const dow = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0,0,0,0);
    } else if (mode === 'quarter') {
      start = new Date(now); start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0);
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

  _updateChart() {
    const ctx = document.getElementById('gcChart');
    if (!ctx) return;
    if (this._chart) { this._chart.destroy(); this._chart = null; }

    const range = this._getRange();
    let group = document.getElementById('gcGroup').value;
    const type = document.getElementById('gcType').value;
    const cumulative = document.getElementById('gcCumulative').checked;
    const budgetVsActual = document.getElementById('gcBudgetVsActual').checked;
    const metrics = [];
    document.querySelectorAll('.gc-metric:checked').forEach(c => metrics.push(c.value));

    const isPie = type === 'pie' || type === 'doughnut';
    const isArea = type === 'area';
    document.getElementById('gcChartContainer').className = 'chart-container' + (isPie ? ' pie-chart' : '');

    document.getElementById('gcBudgetWrap').style.display = group === 'category' ? '' : 'none';

    const allTx = Store.getTransactions();
    const filtered = allTx.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d >= range.start && d <= range.end;
    });

    this._renderStats(filtered, range);

    document.getElementById('gcInfo').textContent = `${filtered.length} movimientos · ${range.start.toLocaleDateString()} - ${range.end.toLocaleDateString()}`;
    if (filtered.length === 0) { ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }

    if (range.days > 93 && group === 'day') group = 'week';
    if (range.days > 365 && group === 'week') group = 'month';

    if (isPie) {
      this._renderPie(ctx, filtered, type, metrics, group);
    } else if (budgetVsActual && group === 'category') {
      this._renderBudgetVsActual(ctx, filtered, range);
    } else {
      this._renderBars(ctx, filtered, isArea ? 'line' : type, metrics, group, cumulative, range, isArea);
    }
  },

  _renderStats(tx, range) {
    const el = document.getElementById('gcStats');
    const income = tx.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const goals = Store.getSavingGoals();
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0) + (Store.getTotalRoundUpSavings() || 0);
    const days = Math.max(1, Math.ceil((range.end - range.start) / 86400000));
    el.innerHTML = `
      <div class="gc-stat-card"><span class="gc-stat-label">Ingresos</span><span class="gc-stat-val income">+${income.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Gastos</span><span class="gc-stat-val expense">-${expense.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Balance</span><span class="gc-stat-val" style="color:${balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${balance >= 0 ? '+' : ''}${balance.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Ahorro total</span><span class="gc-stat-val" style="color:var(--primary)">${totalSaved.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Media/día</span><span class="gc-stat-val">${(expense / days).toFixed(1)}€</span></div>
    `;
  },

  _aggregate(tx, group) {
    const map = {};
    tx.forEach(t => {
      const isIncome = t.type === 'Ingreso';
      let key;
      const d = new Date(t.date + 'T00:00:00');
      if (group === 'day') key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      else if (group === 'week') {
        const dow = d.getDay();
        const mon = new Date(d); mon.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
        key = `Sem ${String(mon.getDate()).padStart(2,'0')}/${String(mon.getMonth()+1).padStart(2,'0')}`;
      } else if (group === 'month') key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      else if (group === 'category') key = t.category || 'Otros';
      else key = t.paymentMethod || 'Sin método';

      if (!map[key]) map[key] = { income: 0, expense: 0 };
      if (isIncome) map[key].income += t.amount;
      else map[key].expense += t.amount;
    });

    let labels;
    if (group === 'day' || group === 'week') {
      labels = Object.keys(map).sort((a, b) => {
        const ma = a.startsWith('Sem ') ? a.replace('Sem ','').split('/').reverse().map(Number) : (a.includes('/') ? a.split('/').reverse().map(Number) : [0,0]);
        const mb = b.startsWith('Sem ') ? b.replace('Sem ','').split('/').reverse().map(Number) : (b.includes('/') ? b.split('/').reverse().map(Number) : [0,0]);
        return (ma[0]||0) - (mb[0]||0) || (ma[1]||0) - (mb[1]||0);
      });
    } else {
      labels = Object.keys(map).sort((a, b) => a.localeCompare(b));
    }

    const result = { labels };
    result.values = {};
    labels.forEach(l => {
      result.values[l] = { income: map[l].income, expense: map[l].expense, balance: map[l].income - map[l].expense };
    });
    return result;
  },

  _renderBars(ctx, tx, type, metrics, group, cumulative, range, isArea) {
    const data = this._aggregate(tx, group);
    if (!data.labels.length) return;
    const colors = {
      income: { bg: 'rgba(16,185,129,0.6)', border: '#10B981', grad: ['rgba(16,185,129,0.6)','rgba(16,185,129,0.05)'] },
      expense: { bg: 'rgba(239,68,68,0.6)', border: '#EF4444', grad: ['rgba(239,68,68,0.6)','rgba(239,68,68,0.05)'] },
      balance: { bg: 'rgba(79,70,229,0.6)', border: '#4F46E5', grad: ['rgba(79,70,229,0.6)','rgba(79,70,229,0.05)'] },
      savings: { bg: 'rgba(139,92,246,0.6)', border: '#8B5CF6', grad: ['rgba(139,92,246,0.6)','rgba(139,92,246,0.05)'] },
    };
    const names = { income: 'Ingresos', expense: 'Gastos', balance: 'Balance', savings: 'Ahorro' };
    const datasets = [];

    metrics.forEach(m => {
      let values = data.labels.map(l => data.values[l][m]);
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

    this._chart = new Chart(ctx, {
      type,
      data: { labels: data.labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const val = c.parsed.y;
                const prefix = val >= 0 ? '' : '';
                return ` ${c.dataset.label}: ${prefix}${val.toFixed(2)}€`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: !cumulative, ticks: { callback: v => v.toFixed(0) + '€', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  },

  _renderBudgetVsActual(ctx, tx, range) {
    const limits = Store.getCategoryLimits();
    const cats = Object.keys(limits);
    if (cats.length === 0) { ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }

    const periodWeeks = Math.max(1, range.days / 7);
    const spent = {};
    tx.filter(t => t.type !== 'Ingreso').forEach(t => {
      const cat = t.category || 'Otros';
      spent[cat] = (spent[cat] || 0) + t.amount;
    });

    const labels = cats.filter(c => limits[c] > 0).sort();
    if (labels.length === 0) return;

    const budgeted = labels.map(c => limits[c] * periodWeeks);
    const actual = labels.map(c => spent[c] || 0);
    const palette = ['#10B981','#EF4444','#3B82F6','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316','#14B8A6','#6366F1'];

    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Presupuestado',
            data: budgeted,
            backgroundColor: 'rgba(79,70,229,0.15)',
            borderColor: '#4F46E5',
            borderWidth: 2,
            borderDash: [5,5],
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: 'Real',
            data: actual,
            backgroundColor: labels.map((_, i) => palette[i % palette.length]),
            borderColor: labels.map((_, i) => palette[i % palette.length]),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const budgetVal = budgeted[c.dataIndex];
                const actualVal = actual[c.dataIndex];
                const diff = budgetVal - actualVal;
                const extra = diff >= 0 ? ` (${diff.toFixed(1)}€ bajo presupuesto)` : ` (${Math.abs(diff).toFixed(1)}€ sobre presupuesto)`;
                return ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)}€${c.datasetIndex === 1 ? extra : ''}`;
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + '€', font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  },

  _renderPie(ctx, tx, type, metrics, group) {
    const data = this._aggregate(tx, group);
    if (!data.labels.length) return;
    const palette = ['#4F46E5','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#14B8A6','#6366F1'];
    const names = { income: 'Ingreso', expense: 'Gasto', balance: 'Balance', savings: 'Ahorro' };
    const labels = []; const values = []; const bgColors = []; let ci = 0;

    metrics.forEach(m => {
      data.labels.forEach(l => {
        const v = data.values[l][m];
        if (v > 0) {
          labels.push(`${names[m]}: ${l}`);
          values.push(v);
          bgColors.push(palette[ci++ % palette.length]);
        }
      });
    });

    if (values.length === 0) { ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }
    const total = values.reduce((s, v) => s + v, 0);
    const displayTotal = total.toFixed(0) + '€';

    this._chart = new Chart(ctx, {
      type,
      data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderColor: '#fff', borderWidth: 2, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { animateRotate: true, duration: 600 },
        cutout: type === 'doughnut' ? '55%' : 0,
        plugins: {
          legend: { display: true, position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
          tooltip: {
            backgroundColor: 'rgba(30,41,59,0.95)',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => {
                const pct = ((c.parsed / total) * 100).toFixed(1);
                return ` ${c.label}: ${c.parsed.toFixed(2)}€ (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  _gradient(ctx, colors) {
    if (!ctx || !ctx.getContext) return colors[0];
    const c = ctx.getContext('2d');
    const { width, height } = c.canvas;
    const g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    return g;
  },
};
