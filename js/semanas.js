const Semanas = {
  render() {
    const el = document.getElementById('tab-semanas');
    const transactions = App.getCurrentTransactions();
    const month = App.getCurrentViewMonth();
    const [year, m] = month.split('-').map(Number);
    const weeks = this._getWeeks(year, m - 1);

    el.innerHTML = '<div class="card"><div class="card-title" style="margin-bottom:16px">Desglose semanal</div><div class="week-grid" id="weekGrid"></div></div>';

    const grid = document.getElementById('weekGrid');
    let html = '';
    weeks.forEach((week, idx) => {
      const weekTx = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d >= week.start && d <= week.end;
      });
      const income = weekTx.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
      const expense = weekTx.filter(t => t.type !== 'Ingreso').reduce((s, t) => s + t.amount, 0);
      const balance = income - expense;

      const catTotals = {};
      weekTx.forEach(t => {
        if (t.type !== 'Ingreso') {
          catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
        }
      });
      const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      const catHtml = catEntries.length > 0
        ? '<div class="week-categories">' + catEntries.map(([cat, amt]) =>
            `<div class="week-cat-item"><span class="cat-name">${cat}</span><span class="cat-amount">${amt.toFixed(2)} €</span></div>`
          ).join('') + '</div>'
        : '<div style="font-size:13px;color:var(--text-secondary)">Sin gastos</div>';

      html += `
        <div class="week-card">
          <div class="week-header">
            <span>Semana ${idx + 1}: ${this._formatDate(week.startDisplay)} - ${this._formatDate(week.endDisplay)}</span>
            <span style="font-weight:600;font-size:13px">${weekTx.length} movimientos</span>
          </div>
          <div class="week-body">
            <div class="week-stats">
              <div class="week-stat">
                <div class="week-stat-label">Ingresos</div>
                <div class="week-stat-value income">${income.toFixed(2)} €</div>
              </div>
              <div class="week-stat">
                <div class="week-stat-label">Gastos</div>
                <div class="week-stat-value expense">${expense.toFixed(2)} €</div>
              </div>
              <div class="week-stat">
                <div class="week-stat-label">Balance</div>
                <div class="week-stat-value" style="color:${balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${balance >= 0 ? '+' : ''}${balance.toFixed(2)} €</div>
              </div>
            </div>
            ${catEntries.length > 0 ? '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Desglose por categoría</div>' : ''}
            ${catHtml}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  _getWeeks(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const weeks = [];
    let currentStart = new Date(firstDay);
    const dow = currentStart.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    currentStart.setDate(currentStart.getDate() + diff);
    currentStart.setHours(0, 0, 0, 0);

    let maxIter = 6;
    while (maxIter-- > 0) {
      const weekEnd = new Date(currentStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      if (currentStart > lastDay) break;

      const startDisplay = new Date(Math.max(currentStart.getTime(), firstDay.getTime()));
      const endDisplay = new Date(Math.min(weekEnd.getTime(), lastDay.getTime()));

      weeks.push({
        start: new Date(currentStart),
        end: new Date(weekEnd),
        startDisplay,
        endDisplay,
      });

      currentStart.setDate(currentStart.getDate() + 7);
    }

    return weeks;
  },

  _formatDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  },
};
