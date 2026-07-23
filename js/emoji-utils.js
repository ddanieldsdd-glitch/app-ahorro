/**
 * EmojiUtils — paleta ampliada, uso frecuente, pegado externo y selector reutilizable.
 */
const EmojiUtils = {
  _EMOJI_RE: /\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu,

  CATEGORIES: [
    { label: 'Comida', emojis: ['🍔','🍕','🌮','🌯','🥙','🍝','🍜','🍲','🥘','🍛','🍱','🍣','🍤','🥟','🥪','🌭','🍟','🥓','🥚','🧀','🥗','🥙','🫔','🥡'] },
    { label: 'Bebida', emojis: ['☕','🧋','🥤','🧃','🍺','🍻','🍷','🥂','🍸','🍹','🧉','🍼','🫖','🍾','🥛'] },
    { label: 'Compra y super', emojis: ['🛒','🛍️','🧺','🏪','🏬','📦','🏷️','🧴','🧻','🧼','🍞','🥖','🥐','🍎','🍌','🥑','🍅','🥕','🧅','🥩'] },
    { label: 'Dinero y gastos', emojis: ['💰','💵','💸','🪙','💳','🏦','🧾','💼','📈','📉','💎','🏧','💲','🤑','🪪'] },
    { label: 'Deporte y gym', emojis: ['💪','🏋️','🏃','🚴','🏊','🧘','⚽','🏀','🎾','🏐','🏈','⚾','🥊','🥋','⛳','🏸','🎿','⛷️','🏄','🧗'] },
    { label: 'Ocio y cine', emojis: ['🎬','🎭','🎮','🎵','🎤','🎧','📺','🎟️','🍿','🎪','🎡','🎯','🎳','🎲','🃏','📷','🎸','🎹'] },
    { label: 'Viaje', emojis: ['✈️','🧳','🗺️','🏖️','🏝️','🏕️','⛺','🚢','🚂','🚆','🚌','🚕','🚗','🛵','🏨','🗼','🗽','⛩️','🌍','🌴'] },
    { label: 'Transporte y gasolina', emojis: ['⛽','🚗','🚙','🛻','🏎️','🅿️','🛣️','🚦','🔧','🛞','⚙️','🔋','🛢️'] },
    { label: 'Ropa y zapatos', emojis: ['👟','👠','👡','🥿','👞','👗','👕','👖','🧥','🧢','👜','👓','💄','💅','⌚','💍'] },
    { label: 'Hogar', emojis: ['🏠','🏡','💡','🔌','🛋️','🛏️','🪑','🚿','🧹','🔑','🪴','🧯','🔨','🪛','🧰'] },
    { label: 'Salud', emojis: ['💊','🏥','🩺','🩹','🧴','🦷','👓','🧬','❤️‍🩹','🩻'] },
    { label: 'Otros', emojis: ['😀','😊','🎉','❤️','⭐','🌟','✅','⚠️','🔑','📋','🐷','🆘','🎁','🐾','🌿','🌸','🌈','📚','🎓','✏️','👥','🤝','🔒','☁️','🚀','🔥','🌙','☀️','⇄','📅','🕐'] },
  ],

  init() {
    if (this._inited) return;
    this._inited = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.emoji-pick-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const inputId = btn.dataset.emojiInput || btn.closest('.emoji-picker-wrap')?.dataset?.emojiInput;
      const emoji = this.normalize(btn.textContent.trim());
      if (inputId && emoji) this._pick(inputId, emoji);
    }, true);
    document.addEventListener('paste', (e) => {
      const el = e.target.closest?.('.emoji-picker-input');
      if (!el) return;
      e.preventDefault();
      const raw = e.clipboardData?.getData('text') || '';
      const emoji = this.extractFirst(raw);
      if (!emoji) return;
      el.value = emoji;
    }, true);
    document.addEventListener('input', (e) => {
      const el = e.target.closest?.('.emoji-picker-input');
      if (!el || !el.value) return;
      const emoji = this.extractFirst(el.value);
      if (emoji && emoji !== el.value) el.value = emoji;
    });
  },

  allBaseEmojis() {
    const seen = new Set();
    const out = [];
    for (const cat of this.CATEGORIES) {
      for (const e of cat.emojis) {
        if (!seen.has(e)) { seen.add(e); out.push(e); }
      }
    }
    return out;
  },

  /** @deprecated use allBaseEmojis() */
  get PALETTE() {
    return this.allBaseEmojis();
  },

  normalize(emoji) {
    const e = this.extractFirst(emoji);
    return e || '';
  },

  extractFirst(text) {
    if (!text) return '';
    this._EMOJI_RE.lastIndex = 0;
    const m = this._EMOJI_RE.exec(String(text));
    return m ? m[0] : '';
  },

  extractAll(text) {
    if (!text) return [];
    return [...String(text).matchAll(this._EMOJI_RE)].map((m) => m[0]);
  },

  isInBasePalette(emoji) {
    return this.allBaseEmojis().includes(emoji);
  },

  _usageMap() {
    if (typeof Store === 'undefined') return {};
    return Store.getEmojiLibrary?.().usage || {};
  },

  _customList() {
    if (typeof Store === 'undefined') return [];
    return Store.getEmojiLibrary?.().custom || [];
  },

  getTopEmojis(limit = 20) {
    const usage = this._usageMap();
    const custom = this._customList();
    const base = this.allBaseEmojis();
    const all = [...new Set([...custom, ...base])];
    return all
      .sort((a, b) => (usage[b] || 0) - (usage[a] || 0) || (custom.indexOf(a) >= 0 ? custom.indexOf(a) : 999) - (custom.indexOf(b) >= 0 ? custom.indexOf(b) : 999))
      .slice(0, limit);
  },

  getSortedPalette() {
    const usage = this._usageMap();
    const custom = this._customList();
    const base = this.allBaseEmojis();
    const seen = new Set();
    const out = [];
    const push = (e) => {
      if (!e || seen.has(e)) return;
      seen.add(e);
      out.push(e);
    };
    [...custom].sort((a, b) => (usage[b] || 0) - (usage[a] || 0)).forEach(push);
    base.sort((a, b) => (usage[b] || 0) - (usage[a] || 0)).forEach(push);
    return out;
  },

  _registerUsage(emoji) {
    if (typeof Store === 'undefined') return;
    Store.trackEmoji(emoji);
  },

  readInput(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return '';
    return this.normalize(el.value.trim());
  },

  _RULES: {
    category: [
      [/comida|aliment|restaur|super|mercad|bebida|café|cafet|bar |panader|fruter|carnic/i, '🍔'],
      [/transport|gasolin|taxi|metro|bus|coche|auto|parking|tren/i, '🚗'],
      [/viviend|alquil|hipotec|luz|agua|gas|internet|wifi|alquiler/i, '🏠'],
      [/salud|medic|farmaci|doctor|dent|hospital/i, '💊'],
      [/educ|libro|curso|escuela|uni|formaci/i, '📚'],
      [/ropa|moda|vestir|zapat|calzado/i, '👟'],
      [/salid|ocio|entreten|juego|cine|fiesta|caprich|diversi|pel[ií]cula|netflix/i, '🎬'],
      [/viaje|vacac|hotel|vuelo|turismo/i, '✈️'],
      [/regalo|cumple/i, '🎁'],
      [/imprevist|urgenc|emerg|sorpresa/i, '⚠️'],
      [/deporte|gym|gimnas|fitness|f[uú]tbol|padel|tenis/i, '🏋️'],
      [/mascot|perro|gato|animal/i, '🐾'],
      [/belleza|peluquer|cosmet/i, '💄'],
      [/compra|shopping/i, '🛒'],
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
      [/transport|movilidad|coche|gasolin/i, '⛽'],
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
      person: '👤',
    };
    return defaults[kind] || '🏷️';
  },

  display(stored, name, kind) {
    return (stored && stored.trim()) || this.inferDefault(name, kind);
  },

  renderPicker(inputId, { value = '', compact = false, maxVisible = 24 } = {}) {
    const usage = this._usageMap();
    const top = this.getTopEmojis(maxVisible);
    const customOnly = this._customList().filter((e) => !this.isInBasePalette(e) && !top.includes(e));
    const btn = (e, hot) => {
      const count = usage[e] || 0;
      const title = count > 0 ? `${e} · usado ${count} veces` : e;
      return `<button type="button" class="emoji-pick-btn${hot ? ' emoji-pick-hot' : ''}" data-emoji-input="${inputId}" aria-label="${esc(title)}" title="${esc(title)}">${e}</button>`;
    };

    const topHtml = top.length
      ? `<div class="emoji-picker-section"><div class="emoji-picker-section-label">⭐ Más usados</div><div class="emoji-picker-grid">${top.map((e) => btn(e, (usage[e] || 0) >= 3)).join('')}</div></div>`
      : '';

    const customHtml = customOnly.length
      ? `<div class="emoji-picker-section"><div class="emoji-picker-section-label">📌 Pegados / personalizados</div><div class="emoji-picker-grid">${customOnly.map((e) => btn(e, true)).join('')}</div></div>`
      : '';

    const catsHtml = this.CATEGORIES.map((cat) => {
      const sorted = [...cat.emojis].sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
      return `<details class="emoji-picker-cat"${compact ? '' : ' open'}>
        <summary>${cat.label} (${cat.emojis.length})</summary>
        <div class="emoji-picker-grid">${sorted.map((e) => btn(e, (usage[e] || 0) >= 2)).join('')}</div>
      </details>`;
    }).join('');

    return `
      <div class="emoji-picker-wrap" data-emoji-input="${inputId}">
        <input type="text" id="${inputId}" class="emoji-picker-input" placeholder="Pega o elige un emoji…" maxlength="16" value="${esc(value)}" inputmode="text" autocomplete="off">
        <div class="emoji-picker-hint">Pega un emoji desde WhatsApp, teclado, etc. — se guardará y sincronizará en todos tus dispositivos.</div>
        ${topHtml}
        ${customHtml}
        <details class="emoji-picker-more"${compact ? '' : ' open'}>
          <summary>Emojis por categoría</summary>
          <div class="emoji-picker-cats">${catsHtml}</div>
        </details>
        <button type="button" class="btn btn-secondary btn-sm emoji-picker-clear" onclick="EmojiUtils._pick('${inputId}','',true)">↩ Automático</button>
      </div>`;
  },

  _pick(inputId, emoji, isClear) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = isClear ? '' : (this.normalize(emoji) || emoji);
  },
};

document.addEventListener('DOMContentLoaded', () => EmojiUtils.init());
