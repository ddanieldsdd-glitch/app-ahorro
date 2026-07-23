/**
 * GraficosTutorial — Tutorial del dashboard de gráficas.
 */
const GraficosTutorial = {
  _step: 0,

  _steps: [
    {
      title: '📊 Tu dashboard de gráficas',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          La pestaña <strong>Gráficos</strong> muestra varias visualizaciones a la vez. Cada panel es independiente:
          puedes ver gastos por categoría, tendencias y presupuesto <strong>simultáneamente</strong>.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">🍩</div>
            <div style="font-size:11px;font-weight:600">Desglose</div>
            <div style="font-size:10px;color:var(--text-secondary)">Categorías, grupos, métodos</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">📈</div>
            <div style="font-size:11px;font-weight:600">Tendencias</div>
            <div style="font-size:10px;color:var(--text-secondary)">Ingresos vs gastos en el tiempo</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">🎯</div>
            <div style="font-size:11px;font-weight:600">Presupuesto</div>
            <div style="font-size:10px;color:var(--text-secondary)">Real vs planificado</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">💳</div>
            <div style="font-size:11px;font-weight:600">Saldo</div>
            <div style="font-size:10px;color:var(--text-secondary)">Evolución de tu cuenta</div>
          </div>
        </div>`,
    },
    {
      title: '⚙ Personalizar el dashboard',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Pulsa <strong>Personalizar</strong> para entrar en modo edición:
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">⠿</span>
            <span><strong>Arrastra</strong> paneles para reordenarlos (escritorio)</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">↑↓</span>
            <span>Usa las flechas en <strong>móvil</strong> para cambiar el orden</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">↔</span>
            <span>Cambia el ancho de un panel (mitad o completo)</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">✕</span>
            <span>Elimina gráficas que no necesites</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary)">
          Tu diseño se guarda en tu perfil y se sincroniza entre dispositivos si tienes la nube activada.
        </div>`,
    },
    {
      title: '＋ Añadir y configurar gráficas',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Pulsa <strong>＋ Añadir gráfica</strong> para elegir una plantilla preconfigurada.
          Cada panel tiene su propio botón <strong>⚙</strong> para ajustar:
        </p>
        <ul style="font-size:12px;line-height:1.8;color:var(--text);margin:0 0 12px 18px;padding:0">
          <li><strong>Rango:</strong> semana, mes, 3 meses, año o todo el historial</li>
          <li><strong>Agrupar:</strong> por día, semana, categoría, grupo o método</li>
          <li><strong>Tipo:</strong> barras, línea, área, circular o anillo</li>
          <li><strong>Métricas:</strong> ingresos, gastos, balance o ahorro</li>
          <li><strong>Vs Presupuesto:</strong> compara lo gastado con tu plan (categorías/grupos)</li>
        </ul>
        <div style="font-size:12px;color:var(--income);font-weight:600">
          Consejo: combina un desglose por categoría con una tendencia temporal para ver el panorama completo.
        </div>`,
    },
    {
      title: '📅 Datos históricos y rangos largos',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Los gráficos incluyen <strong>meses archivados</strong>, no solo el mes activo.
          Así puedes ver tendencias de todo el año o historial completo.
        </p>
        <div style="background:var(--bg);padding:12px;border-radius:8px;font-size:12px;line-height:1.6;margin-bottom:12px">
          En rangos largos, la app ajusta automáticamente la agrupación
          (por ejemplo, de días a semanas) para que el gráfico sea legible.
        </div>
        <div style="font-size:12px;color:var(--text-secondary)">
          Las tarjetas superiores muestran siempre el resumen del <strong>mes actual</strong>.
        </div>`,
    },
    {
      title: '✅ ¡Listo para explorar!',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Ya puedes montar tu propio panel de control financiero:
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px">1. Revisa el diseño por defecto (4 gráficas)</div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px">2. Personaliza y añade las que te interesen</div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px">3. Usa <strong>↺ Restaurar</strong> si quieres volver al inicio</div>
        </div>
        <div style="font-size:12px;color:var(--income);font-weight:600;text-align:center">
          Pulsa ? en cualquier momento para volver a ver este tutorial.
        </div>`,
    },
  ],

  open(startStep = 0) {
    this._step = Math.max(0, Math.min(startStep, this._steps.length - 1));
    this._render();
  },

  _render() {
    const s = this._steps[this._step];
    const total = this._steps.length;
    const isFirst = this._step === 0;
    const isLast = this._step === total - 1;

    const dots = Array.from({ length: total }, (_, i) =>
      `<span style="width:8px;height:8px;border-radius:50%;display:inline-block;
        background:${i === this._step ? 'var(--primary)' : 'var(--border)'};
        transition:background .2s;cursor:pointer" onclick="GraficosTutorial._goTo(${i})"></span>`
    ).join('');

    App.openModal({
      title: s.title,
      body: `
        ${s.body}
        <div style="display:flex;justify-content:center;gap:6px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
          ${dots}
        </div>
        <div style="text-align:center;font-size:11px;color:var(--text-secondary);margin-top:6px">
          Paso ${this._step + 1} de ${total}
        </div>`,
      actions: [
        ...(isFirst ? [] : [{ label: '← Anterior', cb: () => this._prev() }]),
        isLast
          ? { label: '✅ Entendido', primary: true, cb: () => { localStorage.setItem('ahorro_graficos_tutorial_seen', '1'); if (typeof Graficos !== 'undefined') Graficos._dismissWelcome(); } }
          : { label: 'Siguiente →', primary: true, cb: () => this._next() },
      ],
    });
  },

  _next() {
    if (this._step < this._steps.length - 1) { this._step++; this._render(); }
  },

  _prev() {
    if (this._step > 0) { this._step--; this._render(); }
  },

  _goTo(i) {
    this._step = i;
    this._render();
  },
};
