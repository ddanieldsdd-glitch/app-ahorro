/**
 * Graficos — Dashboard personalizable de gráficas financieras.
 */
const Graficos = {
  _charts: new Map(),
  _editMode: false,
  _dragId: null,
  _layoutKey: 'ahorro_chart_dashboard',
  _maxPanels: 6,

  TEMPLATES: [
    {
      id: 'cat-doughnut',
      title: 'Gastos por categoría',
      icon: '🍩',
      size: 'half',
      config: { range: 'month', group: 'category', type: 'doughnut', metrics: ['expense'], cumulative: false, budgetVsActual: false, saldoView: 'none' },
    },
    {
      id: 'income-expense-trend',
      title: 'Ingresos vs gastos',
      icon: '📈',
      size: 'half',
      config: { range: 'quarter', group: 'week', type: 'area', metrics: ['income', 'expense'], cumulative: false, budgetVsActual: false, saldoView: 'none' },
    },
    {
      id: 'budget-category',
      title: 'Presupuesto vs real',
      icon: '🎯',
      size: 'half',
      config: { range: 'month', group: 'category', type: 'bar', metrics: ['expense'], cumulative: false, budgetVsActual: true, saldoView: 'none' },
    },
    {
      id: 'saldo-evolution',
      title: 'Evolución de saldo',
      icon: '💳',
      size: 'half',
      config: { range: 'quarter', group: 'week', type: 'line', metrics: ['balance'], cumulative: false, budgetVsActual: false, saldoView: 'checking' },
    },
    {
      id: 'group-bars',
      title: 'Gastos por grupo',
      icon: '📦',
      size: 'half',
      config: { range: 'month', group: 'group', type: 'bar', metrics: ['expense'], cumulative: false, budgetVsActual: false, saldoView: 'none' },
    },
    {
      id: 'method-pie',
      title: 'Métodos de pago',
      icon: '💳',
      size: 'half',
      config: { range: 'month', group: 'method', type: 'pie', metrics: ['expense'], cumulative: false, budgetVsActual: false, saldoView: 'none' },
    },
    {
      id: 'budget-group',
      title: 'Presupuesto por grupo',
      icon: '🏷️',
      size: 'half',
      config: { range: 'month', group: 'group', type: 'bar', metrics: ['expense'], cumulative: false, budgetVsActual: true, saldoView: 'none' },
    },
    {
      id: 'year-monthly',
      title: 'Tendencia anual',
      icon: '📅',
      size: 'full',
      config: { range: 'year', group: 'month', type: 'bar', metrics: ['income', 'expense'], cumulative: false, budgetVsActual: false, saldoView: 'none' },
    },
  ],

  _defaultLayout() {
    const ids = ['cat-doughnut', 'income-expense-trend', 'budget-category', 'saldo-evolution'];
    return {
      version: 1,
      panels: ids.map((tid, i) => {
        const tpl = this.TEMPLATES.find(t => t.id === tid);
        return {
          id: 'p_' + tid,
          templateId: tid,
          title: tpl.title,
          order: i,
          size: tpl.size,
          visible: true,
          config: { ...tpl.config },
        };
      }),
    };
  },

  _loadLayout() {
    try {
      const raw = localStorage.getItem(this._layoutKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === 1 && Array.isArray(parsed.panels)) return parsed;
      }
    } catch { /* ignore */ }
    return this._defaultLayout();
  },

  _saveLayout(layout) {
    localStorage.setItem(this._layoutKey, JSON.stringify(layout));
  },

  _newPanelId() {
    return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  render() {
    this._destroyAllCharts();
    const el = document.getElementById('tab-graficos');
    if (!el) return;

    const layout = this._loadLayout();
    const visibleCount = layout.panels.filter(p => p.visible).length;
    const showBanner = !localStorage.getItem('ahorro_graficos_tutorial_seen');

    el.innerHTML = `
      ${showBanner ? `
      <div class="gc-welcome-banner" id="gcWelcomeBanner">
        <div>
          <strong>📊 Nuevo dashboard de gráficas</strong>
          <p>Añade, reordena y personaliza cada gráfica. Pulsa <em>Personalizar</em> o el botón ? para aprender.</p>
        </div>
        <div class="gc-welcome-actions">
          <button class="btn btn-primary btn-sm" onclick="GraficosTutorial.open(0);Graficos._dismissWelcome()">Ver tutorial</button>
          <button class="btn btn-secondary btn-sm" onclick="Graficos._dismissWelcome()">Entendido</button>
        </div>
      </div>` : ''}
      <div class="gc-stats" id="gcStats"></div>
      <div class="gc-toolbar">
        <button class="btn btn-sm ${this._editMode ? 'btn-primary' : 'btn-secondary'}" id="gcEditBtn" onclick="Graficos._toggleEdit()">
          ${this._editMode ? '✓ Listo' : '⚙ Personalizar'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Graficos._openAddPanel()">＋ Añadir gráfica</button>
        <button class="btn btn-secondary btn-sm" onclick="Graficos._restoreDefault()" title="Restaurar diseño inicial">↺ Restaurar</button>
        <button class="btn btn-secondary btn-sm gc-help-btn" onclick="GraficosTutorial.open(0)" title="Tutorial de gráficas">?</button>
      </div>
      <div class="gc-dashboard ${this._editMode ? 'gc-dashboard-edit' : ''}" id="gcDashboard">
        ${this._renderPanelsHtml(layout)}
      </div>
      ${visibleCount === 0 ? '<div class="gc-empty">No hay gráficas visibles. Pulsa <strong>Añadir gráfica</strong> para empezar.</div>' : ''}
    `;

    this._renderGlobalStats();
    this._bindDashboardEvents(layout);
    layout.panels.filter(p => p.visible).sort((a, b) => a.order - b.order).forEach(p => this._renderPanelChart(p));
  },

  _dismissWelcome() {
    localStorage.setItem('ahorro_graficos_tutorial_seen', '1');
    const b = document.getElementById('gcWelcomeBanner');
    if (b) b.remove();
  },

  _renderPanelsHtml(layout) {
    return layout.panels
      .filter(p => p.visible)
      .sort((a, b) => a.order - b.order)
      .map(p => this._panelHtml(p))
      .join('');
  },

  _panelHtml(panel) {
    const cfg = panel.config;
    const isPie = cfg.type === 'pie' || cfg.type === 'doughnut';
    const metricsHtml = ['income', 'expense', 'balance', 'savings'].map(m => {
      const labels = { income: 'Ingresos', expense: 'Gastos', balance: 'Balance', savings: 'Ahorro' };
      const checked = (cfg.metrics || []).includes(m) ? 'checked' : '';
      return `<label><input type="checkbox" class="gc-panel-metric" data-metric="${m}" ${checked}> ${labels[m]}</label>`;
    }).join('');

    return `
      <div class="gc-panel gc-panel-${panel.size}" data-panel-id="${panel.id}" draggable="${this._editMode ? 'true' : 'false'}">
        <div class="gc-panel-header">
          ${this._editMode ? '<span class="gc-panel-drag" title="Arrastrar">⠿</span>' : ''}
          <span class="gc-panel-title">${panel.title}</span>
          <div class="gc-panel-actions">
            <button class="gc-panel-btn" title="Configurar" onclick="Graficos._togglePanelConfig('${panel.id}')">⚙</button>
            ${this._editMode ? `
              <button class="gc-panel-btn" title="Subir" onclick="Graficos._movePanel('${panel.id}',-1)">↑</button>
              <button class="gc-panel-btn" title="Bajar" onclick="Graficos._movePanel('${panel.id}',1)">↓</button>
              <button class="gc-panel-btn" title="Ancho completo" onclick="Graficos._togglePanelSize('${panel.id}')">↔</button>
              <button class="gc-panel-btn gc-panel-btn-danger" title="Eliminar" onclick="Graficos._removePanel('${panel.id}')">✕</button>
            ` : ''}
          </div>
        </div>
        <div class="gc-panel-config" id="gcCfg_${panel.id}" style="display:none">
          <div class="gc-panel-config-row">
            <label>Rango</label>
            <select class="gc-cfg-range" data-field="range">
              <option value="week" ${cfg.range === 'week' ? 'selected' : ''}>Esta semana</option>
              <option value="month" ${cfg.range === 'month' ? 'selected' : ''}>Este mes</option>
              <option value="quarter" ${cfg.range === 'quarter' ? 'selected' : ''}>3 meses</option>
              <option value="year" ${cfg.range === 'year' ? 'selected' : ''}>Este año</option>
              <option value="all" ${cfg.range === 'all' ? 'selected' : ''}>Todo</option>
            </select>
          </div>
          <div class="gc-panel-config-row">
            <label>Agrupar</label>
            <select class="gc-cfg-group" data-field="group">
              <option value="day" ${cfg.group === 'day' ? 'selected' : ''}>Día</option>
              <option value="week" ${cfg.group === 'week' ? 'selected' : ''}>Semana</option>
              <option value="month" ${cfg.group === 'month' ? 'selected' : ''}>Mes</option>
              <option value="category" ${cfg.group === 'category' ? 'selected' : ''}>Categoría</option>
              <option value="group" ${cfg.group === 'group' ? 'selected' : ''}>Grupo</option>
              <option value="method" ${cfg.group === 'method' ? 'selected' : ''}>Método</option>
            </select>
          </div>
          <div class="gc-panel-config-row">
            <label>Tipo</label>
            <select class="gc-cfg-type" data-field="type">
              <option value="bar" ${cfg.type === 'bar' ? 'selected' : ''}>Barras</option>
              <option value="line" ${cfg.type === 'line' ? 'selected' : ''}>Línea</option>
              <option value="area" ${cfg.type === 'area' ? 'selected' : ''}>Área</option>
              <option value="pie" ${cfg.type === 'pie' ? 'selected' : ''}>Circular</option>
              <option value="doughnut" ${cfg.type === 'doughnut' ? 'selected' : ''}>Anillo</option>
            </select>
          </div>
          <div class="gc-panel-config-row gc-cfg-saldo-row" style="${isPie ? 'display:none' : ''}">
            <label>Saldo</label>
            <select class="gc-cfg-saldo" data-field="saldoView">
              <option value="none" ${cfg.saldoView === 'none' ? 'selected' : ''}>No mostrar</option>
              <option value="checking" ${cfg.saldoView === 'checking' ? 'selected' : ''}>Cuenta corriente</option>
              <option value="total_liquid" ${cfg.saldoView === 'total_liquid' ? 'selected' : ''}>CC + Ahorro</option>
              <option value="total_wealth" ${cfg.saldoView === 'total_wealth' ? 'selected' : ''}>CC + Ahorro + Efectivo</option>
            </select>
          </div>
          <div class="gc-panel-config-row checkbox-group gc-cfg-metrics">${metricsHtml}</div>
          <div class="gc-panel-config-row gc-cfg-flags">
            <label><input type="checkbox" class="gc-cfg-cumulative" ${cfg.cumulative ? 'checked' : ''}> Acumulado</label>
            <label class="gc-cfg-budget-wrap" style="${cfg.group === 'category' || cfg.group === 'group' ? '' : 'display:none'}">
              <input type="checkbox" class="gc-cfg-budget" ${cfg.budgetVsActual ? 'checked' : ''}> Vs Presupuesto
            </label>
          </div>
        </div>
        <div class="chart-container gc-panel-chart${isPie ? ' pie-chart' : ''}" id="gcChartWrap_${panel.id}">
          <canvas id="gcChart_${panel.id}"></canvas>
        </div>
        <div class="gc-panel-info" id="gcInfo_${panel.id}"></div>
      </div>`;
  },

  _renderGlobalStats() {
    const el = document.getElementById('gcStats');
    if (!el) return;
    const range = ChartEngine.resolveRange('month');
    const tx = ChartEngine.filterTransactions(range);
    const s = ChartEngine.computeStats(tx, range);
    el.innerHTML = `
      <div class="gc-stat-card"><span class="gc-stat-label">Ingresos (mes)</span><span class="gc-stat-val income">+${s.income.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Gastos (mes)</span><span class="gc-stat-val expense">-${s.expense.toFixed(0)}€</span></div>
      <div class="gc-stat-card"><span class="gc-stat-label">Balance (mes)</span><span class="gc-stat-val" style="color:${s.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${s.balance >= 0 ? '+' : ''}${s.balance.toFixed(0)}€</span></div>
      ${s.checkingBalance !== null ? `<div class="gc-stat-card"><span class="gc-stat-label">💳 Cuenta</span><span class="gc-stat-val" style="color:var(--primary)">${s.checkingBalance.toFixed(0)}€</span></div>` : ''}
      <div class="gc-stat-card"><span class="gc-stat-label">Media/día</span><span class="gc-stat-val">${(s.expense / s.days).toFixed(1)}€</span></div>
    `;
  },

  _bindDashboardEvents(layout) {
    const dash = document.getElementById('gcDashboard');
    if (!dash) return;

    dash.querySelectorAll('.gc-panel').forEach(panelEl => {
      const panelId = panelEl.dataset.panelId;
      panelEl.querySelectorAll('select, input').forEach(input => {
        input.addEventListener('change', () => this._onPanelConfigChange(panelId));
      });

      if (this._editMode) {
        panelEl.addEventListener('dragstart', (e) => {
          this._dragId = panelId;
          panelEl.classList.add('gc-panel-dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        panelEl.addEventListener('dragend', () => {
          panelEl.classList.remove('gc-panel-dragging');
          this._dragId = null;
        });
        panelEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        panelEl.addEventListener('drop', (e) => {
          e.preventDefault();
          const targetId = panelEl.dataset.panelId;
          if (this._dragId && this._dragId !== targetId) this._reorderPanels(this._dragId, targetId);
        });
      }
    });
  },

  _onPanelConfigChange(panelId) {
    const layout = this._loadLayout();
    const panel = layout.panels.find(p => p.id === panelId);
    if (!panel) return;

    const panelEl = document.querySelector(`[data-panel-id="${panelId}"]`);
    if (!panelEl) return;

    panel.config.range = panelEl.querySelector('.gc-cfg-range').value;
    panel.config.group = panelEl.querySelector('.gc-cfg-group').value;
    panel.config.type = panelEl.querySelector('.gc-cfg-type').value;
    panel.config.saldoView = panelEl.querySelector('.gc-cfg-saldo').value;
    panel.config.cumulative = panelEl.querySelector('.gc-cfg-cumulative').checked;
    panel.config.budgetVsActual = panelEl.querySelector('.gc-cfg-budget').checked;

    const metrics = [];
    panelEl.querySelectorAll('.gc-panel-metric:checked').forEach(c => metrics.push(c.dataset.metric));
    panel.config.metrics = metrics.length ? metrics : ['expense'];

    const isPie = panel.config.type === 'pie' || panel.config.type === 'doughnut';
    const saldoRow = panelEl.querySelector('.gc-cfg-saldo-row');
    if (saldoRow) saldoRow.style.display = isPie ? 'none' : '';
    const budgetWrap = panelEl.querySelector('.gc-cfg-budget-wrap');
    if (budgetWrap) {
      budgetWrap.style.display = (panel.config.group === 'category' || panel.config.group === 'group') ? '' : 'none';
      if (panel.config.group !== 'category' && panel.config.group !== 'group') panel.config.budgetVsActual = false;
    }

    const wrap = document.getElementById('gcChartWrap_' + panelId);
    if (wrap) wrap.className = 'chart-container gc-panel-chart' + (isPie ? ' pie-chart' : '');

    this._saveLayout(layout);
    this._renderPanelChart(panel);
  },

  _renderPanelChart(panel) {
    const canvas = document.getElementById('gcChart_' + panel.id);
    const info = document.getElementById('gcInfo_' + panel.id);
    if (!canvas) return;

    const prev = this._charts.get(panel.id);
    ChartEngine.destroyChart(prev);

    const result = ChartEngine.buildChart(canvas, panel.config);
    this._charts.set(panel.id, result?.chart || null);

    if (info && result) {
      const rangeLabel = { week: 'Semana', month: 'Mes', quarter: '3 meses', year: 'Año', all: 'Todo' }[panel.config.range] || panel.config.range;
      info.textContent = `${result.count} movimientos · ${rangeLabel} · ${result.range.start.toLocaleDateString()} - ${result.range.end.toLocaleDateString()}`;
    }
  },

  _toggleEdit() {
    this._editMode = !this._editMode;
    this.render();
  },

  _togglePanelConfig(panelId) {
    const el = document.getElementById('gcCfg_' + panelId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  _togglePanelSize(panelId) {
    const layout = this._loadLayout();
    const panel = layout.panels.find(p => p.id === panelId);
    if (!panel) return;
    panel.size = panel.size === 'full' ? 'half' : 'full';
    this._saveLayout(layout);
    this.render();
  },

  _movePanel(panelId, dir) {
    const layout = this._loadLayout();
    const visible = layout.panels.filter(p => p.visible).sort((a, b) => a.order - b.order);
    const idx = visible.findIndex(p => p.id === panelId);
    const newIdx = idx + dir;
    if (idx < 0 || newIdx < 0 || newIdx >= visible.length) return;
    const a = visible[idx];
    const b = visible[newIdx];
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    this._saveLayout(layout);
    this.render();
  },

  _reorderPanels(fromId, toId) {
    const layout = this._loadLayout();
    const visible = layout.panels.filter(p => p.visible).sort((a, b) => a.order - b.order);
    const fromIdx = visible.findIndex(p => p.id === fromId);
    const toIdx = visible.findIndex(p => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = visible.splice(fromIdx, 1);
    visible.splice(toIdx, 0, moved);
    visible.forEach((p, i) => { p.order = i; });
    this._saveLayout(layout);
    this.render();
  },

  _removePanel(panelId) {
    const layout = this._loadLayout();
    const panel = layout.panels.find(p => p.id === panelId);
    if (!panel) return;
    panel.visible = false;
    this._saveLayout(layout);
    this.render();
  },

  _restoreDefault() {
    if (!confirm('¿Restaurar el diseño inicial del dashboard? Se perderá tu layout personalizado.')) return;
    localStorage.removeItem(this._layoutKey);
    this._editMode = false;
    this.render();
    App.showToast('Dashboard restaurado');
  },

  _openAddPanel() {
    const layout = this._loadLayout();
    const visibleCount = layout.panels.filter(p => p.visible).length;
    if (visibleCount >= this._maxPanels) {
      App.showToast(`Máximo ${this._maxPanels} gráficas visibles`);
      return;
    }

    const items = this.TEMPLATES.map(t => `
      <button class="gc-template-btn" onclick="Graficos._addFromTemplate('${t.id}')">
        <span class="gc-template-icon">${t.icon}</span>
        <span class="gc-template-title">${t.title}</span>
      </button>
    `).join('');

    App.openModal({
      title: '＋ Añadir gráfica',
      body: `<div class="gc-template-grid">${items}</div>`,
      actions: [{ label: 'Cancelar' }],
    });
  },

  _addFromTemplate(templateId) {
    App._closeModal();
    const layout = this._loadLayout();
    const visibleCount = layout.panels.filter(p => p.visible).length;
    if (visibleCount >= this._maxPanels) {
      App.showToast(`Máximo ${this._maxPanels} gráficas visibles`);
      return;
    }

    const tpl = this.TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;

    const maxOrder = layout.panels.reduce((m, p) => Math.max(m, p.order), -1);
    layout.panels.push({
      id: this._newPanelId(),
      templateId: tpl.id,
      title: tpl.title,
      order: maxOrder + 1,
      size: tpl.size,
      visible: true,
      config: { ...tpl.config },
    });
    this._saveLayout(layout);
    this.render();
    App.showToast(`Gráfica "${tpl.title}" añadida`);
  },

  _destroyAllCharts() {
    this._charts.forEach(c => ChartEngine.destroyChart(c));
    this._charts.clear();
  },
};
