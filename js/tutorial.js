/**
 * Tutorial — Walkthrough interactivo de 6 pasos
 * Muestra un modal paso a paso con navegación Anterior / Siguiente.
 */
const Tutorial = {
  _step: 0,

  _steps: [
    {
      title: '👋 Bienvenido a Presupuesto Personal',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:14px">
          Esta app te ayuda a controlar tus <strong>ingresos y gastos</strong>, ahorrar, gestionar deudas y sincronizar
          todos tus datos entre móvil y ordenador de forma <strong>privada y cifrada</strong>.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">📝</div>
            <div style="font-size:11px;font-weight:600">Movimientos</div>
            <div style="font-size:10px;color:var(--text-secondary)">Gastos e ingresos</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">🏠</div>
            <div style="font-size:11px;font-weight:600">Dashboard</div>
            <div style="font-size:10px;color:var(--text-secondary)">Resumen y saldo</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">💡</div>
            <div style="font-size:11px;font-weight:600">Ahorro</div>
            <div style="font-size:10px;color:var(--text-secondary)">Metas y planificados</div>
          </div>
          <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">💸</div>
            <div style="font-size:11px;font-weight:600">Deudas</div>
            <div style="font-size:10px;color:var(--text-secondary)">Balance neto por persona</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);text-align:center">
          Navega entre pestañas con la barra inferior (móvil) o los botones superiores (escritorio).
        </div>`,
    },
    {
      title: '➕ Añadir movimientos',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Pulsa el botón <strong>+</strong> (abajo a la derecha) para añadir un movimiento rápido,
          o ve a <strong>📝 Movimientos</strong> para ver y editar todos.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px">
            <span style="font-size:20px">💸</span>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--expense)">Gasto</div>
              <div style="font-size:11px;color:var(--text-secondary)">Dinero que sale (comida, transporte, ocio…)</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px">
            <span style="font-size:20px">💰</span>
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--income)">Ingreso</div>
              <div style="font-size:11px;color:var(--text-secondary)">Dinero que entra (paga, mensualidad, extra…)</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px">
            <span style="font-size:20px">🐷</span>
            <div>
              <div style="font-size:12px;font-weight:700;color:#6366F1">Traspaso</div>
              <div style="font-size:11px;color:var(--text-secondary)">De cuenta corriente a ahorro (o al revés)</div>
            </div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">
          Cada movimiento tiene <strong>categoría</strong>, <strong>método de pago</strong> y se asigna automáticamente a la <strong>cuenta</strong> correcta
          (Corriente, Ahorro o Efectivo).
        </div>`,
    },
    {
      title: '🏠 Dashboard y presupuesto semanal',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          El <strong>Dashboard</strong> te muestra en tiempo real cuánto puedes gastar hoy sin pasarte del presupuesto.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>💡 HOY PUEDES GASTAR</strong> — calcula tu saldo disponible descontando lo reservado para ahorro,
            imprevistos y gastos planificados.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>📊 Presupuesto semanal</strong> — configura en ⚙️ cuánto ingresas por semana.
            La app reparte ese presupuesto entre alimentación, gastos fijos y ahorro.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🐷 Metas de ahorro</strong> — añade metas con fecha objetivo y la app calcula
            cuánto reservar cada semana automáticamente.
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary)">
          Configura tus importes en <strong>⚙️ → Presupuesto</strong>.
        </div>`,
    },
    {
      title: '💸 Deudas — balance neto (estilo Tricount)',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          La pestaña <strong>💸 Deudas</strong> funciona como Tricount: calcula automáticamente
          el <strong>balance neto</strong> con cada persona.
        </p>
        <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:12px;font-size:12px;line-height:1.7">
          <strong>Ejemplo:</strong><br>
          • Ana te debe <span style="color:var(--income)">+30€</span> (pagaste la cena)<br>
          • Tú le debes a Ana <span style="color:var(--expense)">-15€</span> (ella pagó el café)<br>
          <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;font-weight:700">
            Balance neto → Ana te debe <span style="color:var(--income)">15€</span>
          </div>
          <div style="margin-top:4px;color:var(--text-secondary)">
            Con un solo toque, Ana te paga 15€ y ambas deudas quedan saldadas.
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">
          Pulsa <strong>"Por persona"</strong> para ver el balance neto.<br>
          Pulsa <strong>"Por deuda"</strong> para ver cada deuda individualmente.
        </div>`,
    },
    {
      title: '☁️ Sincronización en la nube',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Para usar la app en <strong>móvil y ordenador con los mismos datos</strong>,
          despliega el servidor en la nube.
        </p>
        <ol style="font-size:12px;line-height:1.8;padding-left:18px;color:var(--text);margin-bottom:12px">
          <li>Crea cuenta gratuita en <strong>fly.io</strong> o <strong>railway.app</strong></li>
          <li>Sigue los pasos de <code>DEPLOY.md</code> en el repositorio de GitHub</li>
          <li>En todos tus dispositivos ve a <strong>⚙️ → Sincronización</strong> y rellena:
            <ul style="margin-top:4px">
              <li><strong>URL del servidor</strong> (ej: <code>https://tu-app.fly.dev</code>)</li>
              <li><strong>Clave de sincronización</strong> (SYNC_KEY que pusiste en el servidor)</li>
              <li><strong>Frase de cifrado</strong> — AES-256, nunca sale de tu dispositivo</li>
            </ul>
          </li>
        </ol>
        <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:11px;color:var(--text-secondary);line-height:1.5">
          🔐 Tus datos se cifran en el dispositivo antes de subirse. El hosting no puede leerlos sin tu frase.
          Si pierdes la frase, exporta a Excel regularmente como backup.
        </div>`,
    },
    {
      title: '📲 Instalar en todos tus dispositivos',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          La app funciona como <strong>PWA</strong> (instalable desde el navegador) y como <strong>app nativa</strong> en Windows y Android.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🤖 Android</strong> — Abre la URL en Chrome → menú ⋮ → <em>Instalar app</em>.<br>
            O instala el APK desde <code>android/</code> con Android Studio.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🍎 iPhone / iPad</strong> — Abre la URL en <strong>Safari</strong> → Compartir → <em>Añadir a pantalla de inicio</em>.
            Funciona offline sin necesidad de cuenta Apple.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🖥 Windows</strong> — Instala con el archivo <code>electron/dist/Presupuesto Personal Setup 2.0.0.exe</code>.<br>
            O abre la URL en Chrome/Edge → icono ⊕ → Instalar.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🍏 macOS</strong> — Genera el <code>.dmg</code> desde Mac con <code>npm run installer:mac</code>.<br>
            Primera vez: clic derecho → Abrir para pasar Gatekeeper.
          </div>
        </div>
        <div style="font-size:12px;color:var(--income);font-weight:600;text-align:center">
          ¡Todo listo! Empieza añadiendo tu primer movimiento con el botón +
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
    const isLast  = this._step === total - 1;

    const dots = Array.from({ length: total }, (_, i) =>
      `<span style="width:8px;height:8px;border-radius:50%;display:inline-block;
        background:${i === this._step ? 'var(--primary)' : 'var(--border)'};
        transition:background .2s;cursor:pointer" onclick="Tutorial._goTo(${i})"></span>`
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
          ? { label: '✅ ¡Empezar!', primary: true, cb: () => {} }
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
