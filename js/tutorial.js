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
            <strong>📊 Presupuesto semanal</strong> — opcionalmente configura ingresos en ⚙️ Ajustes.
            Si no lo haces, la app aprende de tus movimientos y estima cuánto ingresas y gastas.
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.5">
            <strong>🐷 Metas de ahorro</strong> — añade metas con fecha objetivo y la app calcula
            cuánto reservar cada semana automáticamente.
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary)">
          Configura ingresos (opcional) en <strong>⚙️ → Tus ingresos</strong>. Las sugerencias de presupuesto están en <strong>💡 Ahorro</strong>.
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
      title: '☁️ Sincronización con Supabase (gratis)',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:10px">
          Configúralo en <strong>⚙️ → Sincronización (Supabase)</strong>.
          Tus datos viajan <strong>cifrados AES-256</strong> — la nube no puede leerlos.
        </p>
        <ol style="font-size:12px;line-height:1.9;padding-left:18px;color:var(--text);margin-bottom:12px">
          <li>Crea un proyecto gratis en <strong>supabase.com</strong></li>
          <li>En <em>SQL Editor</em> ejecuta el SQL que aparece en Ajustes (botón Copiar SQL)</li>
          <li>En <em>Settings → API Keys</em> copia la <strong>URL</strong> y la <strong>Publishable key</strong></li>
          <li>Pega URL + clave, elige un <strong>ID de perfil</strong> (ej. <code>yo</code>) y tu <strong>frase secreta</strong></li>
          <li>Repite lo mismo en cada dispositivo tuyo</li>
        </ol>
        <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:11px;color:var(--text-secondary);line-height:1.6">
          🔐 Sin la frase de cifrado nadie (ni Supabase) puede leer tus gastos.<br>
          🤝 Para deudas con tu pareja: usa <strong>Espacio compartido</strong> con otra fila y otra frase.
        </div>`,
    },
    {
      title: '🤝 Espacio compartido con tu pareja',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          Cada persona tiene su propio perfil <strong>privado e independiente</strong>.
          Además, podéis compartir un espacio de deudas comunes — estilo Tricount — sin que ninguno vea los gastos del otro.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.6">
            <strong>👤 Tu perfil</strong><br>
            ID de fila: <code>yo</code> · Frase: <em>solo la tuya</em><br>
            <span style="color:var(--text-secondary)">Nadie más puede ver tus gastos e ingresos.</span>
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.6">
            <strong>👤 Perfil de tu pareja</strong><br>
            ID de fila: <code>pareja</code> · Frase: <em>solo la suya</em><br>
            <span style="color:var(--text-secondary)">Configurado en su dispositivo, invisible para ti.</span>
          </div>
          <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;line-height:1.6;border:1.5px solid var(--primary)">
            <strong>🤝 Espacio compartido</strong> (ambos)<br>
            ID de fila: <code>compartido</code> · Frase: <em>la que acordéis juntos</em><br>
            <span style="color:var(--text-secondary)">Configúralo en <strong>⚙️ → Espacio compartido con tu pareja</strong>.</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;background:var(--bg);padding:10px;border-radius:8px">
          En la pestaña <strong>💸 Deudas</strong> todo está unificado: deudas con terceros y con tu pareja en la misma vista.<br>
          Configura <strong>tu nombre</strong> y selecciona a tu pareja en <strong>⚙️ → Espacio compartido</strong>.<br>
          Las deudas con ella se sincronizan solas: lo que tú registras a tu favor, en su app aparece en su contra (estilo Tricount).
        </div>`,
    },
    {
      title: '📊 Gráficos y dashboard',
      body: `
        <p style="font-size:13px;line-height:1.7;color:var(--text);margin-bottom:12px">
          En <strong>📊 Gráficos</strong> puedes ver <strong>varias gráficas a la vez</strong>, cada una con filtros distintos:
          gastos por categoría, tendencias, presupuesto vs real y evolución del saldo.
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">⚙</span>
            <span><strong>Personalizar</strong> para reordenar, añadir o quitar paneles</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">＋</span>
            <span><strong>Añadir gráfica</strong> desde plantillas preconfiguradas</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--bg);padding:10px;border-radius:8px;font-size:12px">
            <span style="font-size:18px">?</span>
            <span>Tutorial dedicado dentro de la pestaña Gráficos</span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">
          Los rangos largos incluyen meses archivados para ver tu historial completo.
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
