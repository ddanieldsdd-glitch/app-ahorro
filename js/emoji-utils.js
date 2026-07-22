/**
 * EmojiUtils — paleta ampliada, inferencia por nombre y selector reutilizable.
 */
const EmojiUtils = {
  PALETTE: [
    '😀','😊','🎉','❤️','⭐','🌟','✅','⚠️','🔑','📋',
    '💰','💵','💸','🪙','💳','🏦','📈','🧾','💼','🎁',
    '🍔','🍕','🍽️','☕','🛒','🥤','🍷','🥗','🍰','🍺',
    '🏠','🏡','💡','🔧','📱','💻','🖥️','📺','🎮','🎵',
    '🚗','🚌','🚕','⛽','✈️','🏖️','🧳','🗺️','🚲','🛵',
    '💊','🏥','🩺','💪','🏋️','🧘','🐾','🌿','🌸','🌈',
    '📚','🎓','✏️','🎨','🎭','🎬','📷','🛍️','👗','👟',
    '🐷','🆘','📦','🏷️','📂','👥','🤝','🔒','☁️','🌍',
    '⇄','📅','🕐','🎯','🔥','💎','🚀','🌙','☀️','🎪',
  ],

  _RULES: {
    category: [
      [/comida|aliment|restaur|super|mercad|bebida|café|cafet|bar |panader|fruter|carnic/i, '🍔'],
      [/transport|gasolin|taxi|metro|bus|coche|auto|parking|tren/i, '🚗'],
      [/viviend|alquil|hipotec|luz|agua|gas|internet|wifi|alquiler/i, '🏠'],
      [/salud|medic|farmaci|doctor|dent|hospital/i, '💊'],
      [/educ|libro|curso|escuela|uni|formaci/i, '📚'],
      [/ropa|moda|vestir|zapat|calzado/i, '👗'],
      [/salid|ocio|entreten|juego|cine|fiesta|caprich|diversi/i, '🎮'],
      [/viaje|vacac|hotel|vuelo|turismo/i, '✈️'],
      [/regalo|cumple/i, '🎁'],
      [/imprevist|urgenc|emerg|sorpresa/i, '⚠️'],
      [/deporte|gym|gimnas|fitness/i, '🏋️'],
      [/mascot|perro|gato|animal/i, '🐾'],
      [/belleza|peluquer|cosmet/i, '💄'],
      [/otros|varios|misc|general/i, '📦'],
    ],
    incomeCategory: [
      [/mensual|nómina|nomina|sueldo|salario|fijo/i, '📅'],
      [/paga|trabajo|empleo|freelance|honorario/i, '💼'],
      [/extra|bonus|propina|regalo|premio/i, '⭐'],
      [/alquil|renta|invers|dividend|inter[eé]s/i, '📈'],
      [/venta|reembolso|devoluci/i, '🧾'],
    ],
    type: [
      [/ingreso|entrada|cobro|salario/i, '💰'],
      [/gasto|pago|compra|salida/i, '💸'],
      [/traspaso|transfer|movimiento interno/i, '⇄'],
    ],
    method: [
      [/efectivo|cash|metálico|metalico/i, '💵'],
      [/tarjeta|card|visa|master/i, '💳'],
      [/bizum|paypal|venmo/i, '📱'],
      [/transfer|banco|domicili/i, '🏦'],
    ],
    expenseGroup: [
      [/comida|aliment|plan comida|nutrici/i, '🍽️'],
      [/ocio|entreten|salid|caprich/i, '🎮'],
      [/viviend|hogar|casa|fijo/i, '🏠'],
      [/transport|movilidad|coche/i, '🚗'],
      [/salud|bienestar/i, '💊'],
      [/ahorro|reserva/i, '🐷'],
    ],
    incomeGroup: [
      [/nómina|nomina|fijo|mensual|salario/i, '💼'],
      [/extra|variable|bonus/i, '⭐'],
      [/invers|renta|pasivo/i, '📈'],
    ],
  },

  inferDefault(name, kind = 'category') {
    if (!name) return '🏷️';
    const rules = this._RULES[kind] || this._RULES.category;
    for (const [re, emoji] of rules) {
      if (re.test(name)) return emoji;
    }
    const defaults = {
      category: '🏷️',
      incomeCategory: '💰',
      type: '📋',
      method: '💳',
      expenseGroup: '📂',
      incomeGroup: '💰',
    };
    return defaults[kind] || '🏷️';
  },

  display(stored, name, kind) {
    return (stored && stored.trim()) || this.inferDefault(name, kind);
  },

  renderPicker(inputId, { value = '', compact = false, maxVisible = 24 } = {}) {
    const visible = this.PALETTE.slice(0, maxVisible);
    const rest = this.PALETTE.slice(maxVisible);
    const btn = (e) =>
      `<button type="button" class="emoji-pick-btn" onclick="EmojiUtils._pick('${inputId}','${e}')" aria-label="${e}">${e}</button>`;
    return `
      <div class="emoji-picker-wrap">
        <input type="text" id="${inputId}" class="emoji-picker-input" placeholder="Elige o escribe…" maxlength="4" value="${esc(value)}">
        <div class="emoji-picker-grid">${visible.map(btn).join('')}</div>
        ${rest.length ? `
          <details class="emoji-picker-more"${compact ? '' : ' open'}>
            <summary>Más emoticonos (${rest.length})</summary>
            <div class="emoji-picker-grid">${rest.map(btn).join('')}</div>
          </details>` : ''}
        <button type="button" class="btn btn-secondary btn-sm emoji-picker-clear" onclick="EmojiUtils._pick('${inputId}','')">↩ Automático</button>
      </div>`;
  },

  _pick(inputId, emoji) {
    const el = document.getElementById(inputId);
    if (el) el.value = emoji;
  },
};
