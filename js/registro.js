/** Normalizes multiple date formats to YYYY-MM-DD.
 *  Accepts: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, ISO strings, DD-MM-YYYY */
function parseISODate(str) {
  if (!str) return '';
  str = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
    const p = str.split(/[\/\-\.]/);
    return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2}$/.test(str)) {
    const p = str.split(/[\/\-\.]/);
    return `20${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  }
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(str)) {
    const p = str.split(/[\/\-\.]/);
    return `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`;
  }
  return str.substring(0, 10);
}

const Registro = {
  _editingId: null,
  _sortMode: 'date_desc',

  render() {
    const el = document.getElementById('tab-registro');
    const isArchived = App.isViewingArchived();
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${isArchived ? 'Movimientos archivados' : 'Nuevo movimiento'}</span>
          ${isArchived ? '' : '<button class="btn btn-secondary btn-sm" onclick="Registro._showImport()">📥 CSV</button>'}
        </div>
        ${isArchived ? '' : `
        <form id="txForm" class="form-grid form-grid-tx">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="txDate" required>
          </div>
          <div class="form-group">
            <label>Importe (€)</label>
            <input type="number" id="txAmount" step="0.01" min="0.01" placeholder="0.00" required style="font-size:18px;font-weight:700">
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="txType"></select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Descripción</label>
            <input type="text" id="txDesc" placeholder="¿Concepto?" maxlength="100">
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <select id="txCategory"></select>
          </div>
          <div class="form-group">
            <label>Pago</label>
            <select id="txMethod"></select>
          </div>
          <div class="form-group">
            <label>Cuenta</label>
            <select id="txAccount">
              <option value="checking">💳 Corriente</option>
              <option value="savings">🐷 Ahorro</option>
              <option value="cash">💵 Efectivo</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Emoticono <span style="font-size:10px;color:var(--text-secondary)">(opcional)</span></label>
            <div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">
              <input type="text" id="txEmoji" placeholder="😀" style="width:48px;text-align:center;font-size:20px;padding:4px;border:1px solid var(--border);border-radius:6px;flex-shrink:0">
              <div style="display:flex;flex-wrap:wrap;gap:3px;max-width:260px" id="txEmojiPicker"></div>
              <button type="button" id="txEmojiMore" onclick="Registro._toggleMoreEmoji()" style="font-size:11px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 6px;color:var(--primary);white-space:nowrap">+más</button>
            </div>
            <div id="txEmojiExtra" style="display:none;flex-wrap:wrap;gap:3px;margin-top:4px"></div>
          </div>
          <input type="hidden" id="txTransferTypeHidden" value="to_savings">
        </form>
        <div id="txDebtContainer" style="margin-top:10px;grid-column:1/-1"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="txSubmit" form="txForm">➕ Añadir</button>
        </div>
        `}
      </div>
      <div class="card" id="semanasSection">
        <div class="card-header">
          <span class="card-title">📅 Desglose semanal</span>
          <span style="font-size:12px;color:var(--text-secondary)" id="semanasMonth"></span>
        </div>
        <div class="week-grid" id="weekGrid"></div>
      </div>
    `;
    if (!isArchived) this._initForm();
    this._renderWeeks();
  },

  _setSort(mode) {
    this._sortMode = mode;
    this.render();
  },

  _initForm() {
    const form = document.getElementById('txForm');
    this._populateSelect('txType', Store.getTypes(), 'Gasto');
    this._populateCategorySelect('Gasto', 'Comida');
    this._populateSelect('txMethod', Store.getPaymentMethods(), 'Tarjeta');
    this._setupInlineAdd();
    document.getElementById('txDate').valueAsDate = new Date();
    // Inject debt inline block
    const debtContainer = document.getElementById('txDebtContainer');
    if (debtContainer) debtContainer.innerHTML = Deudas.inlineFormHtml('tx');
    // Build emoji picker buttons
    this._buildEmojiPicker();

    document.getElementById('txType').addEventListener('change', (e) => {
      const type = e.target.value;
      this._toggleTraspasoMode(type);
      if (type === 'Traspaso') return;
      const currentCat = document.getElementById('txCategory').value;
      const cats = Store.getCategoriesForType(type);
      const defaultCat = type === 'Ingreso' ? (cats.includes('Mensualidad') ? 'Mensualidad' : cats[0]) : 'Comida';
      this._populateCategorySelect(type, cats.includes(currentCat) ? currentCat : defaultCat);
    });
    document.getElementById('txMethod').addEventListener('change', () => {
      const method = document.getElementById('txMethod').value;
      const acc = document.getElementById('txAccount');
      if (acc && method === 'Efectivo') acc.value = 'cash';
      else if (acc && acc.value === 'cash') acc.value = 'checking';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });
  },

  _buildEmojiPicker() {
    const palette = typeof MovementForm !== 'undefined' ? MovementForm._EMOJI_PALETTE : ['😀','🎉','🛒','🍔','☕','🚗','💊','📚','🎮','✈️','🎁','💪','🌟','🔧','📱'];
    const btnStyle = 'font-size:16px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 4px;line-height:1';
    const picker = document.getElementById('txEmojiPicker');
    const extra  = document.getElementById('txEmojiExtra');
    if (!picker || !extra) return;
    picker.innerHTML = palette.slice(0, 15).map(e =>
      `<button type="button" style="${btnStyle}" onclick="document.getElementById('txEmoji').value='${e}'">${e}</button>`
    ).join('');
    extra.innerHTML = palette.slice(15).map(e =>
      `<button type="button" style="${btnStyle}" onclick="document.getElementById('txEmoji').value='${e}'">${e}</button>`
    ).join('');
  },

  _toggleMoreEmoji() {
    const el = document.getElementById('txEmojiExtra');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  },

  _toggleTraspasoMode(type) {
    const isTraspaso = type === 'Traspaso';
    const hide = ['txCategory', 'txMethod', 'txAccount'].map(id => document.getElementById(id)?.closest('.form-group'));
    hide.forEach(el => { if (el) el.style.display = isTraspaso ? 'none' : ''; });
    const desc = document.getElementById('txDesc');
    if (desc && isTraspaso) { desc.value = desc.value || 'Traspaso a ahorro'; }
    // Show/hide transfer subtype selector
    let row = document.getElementById('txTransferTypeRow');
    if (isTraspaso && !row) {
      row = document.createElement('div');
      row.id = 'txTransferTypeRow';
      row.style.cssText = 'margin:8px 0;padding:8px;background:var(--bg);border-radius:8px;border:1px solid var(--border)';
      row.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:6px">Tipo de traspaso:</div>
        <div style="display:flex;gap:6px">
          <button type="button" id="txTransferTo" class="mf-type-btn active" style="flex:1;background:linear-gradient(135deg,#4F46E5,#10B981);color:#fff;border:none;font-size:12px;padding:8px"
            onclick="Registro._setTransferType('to_savings')">💸→🐷 Corriente → Ahorro</button>
          <button type="button" id="txTransferFrom" class="mf-type-btn" style="flex:1;font-size:12px;padding:8px"
            onclick="Registro._setTransferType('from_savings_emergency')">🆘 Ahorro → Corriente (imprevisto)</button>
        </div>`;
      const form = document.getElementById('txForm');
      if (form) {
        const submitRow = form.nextElementSibling;
        form.parentNode.insertBefore(row, form.nextElementSibling);
      }
    }
    if (row) row.style.display = isTraspaso ? '' : 'none';
  },

  _setTransferType(ttype) {
    const hidden = document.getElementById('txTransferTypeHidden');
    if (hidden) hidden.value = ttype;
    const btnTo = document.getElementById('txTransferTo');
    const btnFrom = document.getElementById('txTransferFrom');
    if (!btnTo || !btnFrom) return;
    if (ttype === 'to_savings') {
      btnTo.style.background = 'linear-gradient(135deg,#4F46E5,#10B981)';
      btnTo.style.color = '#fff';
      btnTo.style.border = 'none';
      btnFrom.style.background = '';
      btnFrom.style.color = '';
      btnFrom.style.border = '';
    } else {
      btnFrom.style.background = 'linear-gradient(135deg,#EC4899,#EF4444)';
      btnFrom.style.color = '#fff';
      btnFrom.style.border = 'none';
      btnTo.style.background = '';
      btnTo.style.color = '';
      btnTo.style.border = '';
    }
  },

  _populateSelect(id, options, selected) {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === selected) o.selected = true;
      sel.appendChild(o);
    });
    const addOpt = document.createElement('option');
    addOpt.value = '__add__'; addOpt.textContent = '+ Añadir nuevo...';
    sel.appendChild(addOpt);
  },

  _populateCategorySelect(type, selected) {
    this._populateSelect('txCategory', Store.getCategoriesForType(type), selected);
  },

  _setupInlineAdd() {
    ['txType', 'txCategory', 'txMethod'].forEach(id => {
      const sel = document.getElementById(id);
      let prevValue = sel.value;
      sel.addEventListener('focus', () => { prevValue = sel.value; });
      sel.addEventListener('change', (e) => {
        if (e.target.value !== '__add__') return;
        const type = document.getElementById('txType').value;
        const map = {
          txType: { label: 'tipo', store: 'Type', getter: 'getTypes' },
          txCategory: type === 'Ingreso'
            ? { label: 'categoría de ingreso', store: 'IncomeCategory', getter: 'getIncomeCategories' }
            : { label: 'categoría de gasto', store: 'Category', getter: 'getCategories' },
          txMethod: { label: 'método de pago', store: 'PaymentMethod', getter: 'getPaymentMethods' },
        };
        const { label, store, getter } = map[id];
        App.showPrompt(`Nuevo ${label}`, `Nombre:`, '', (name) => {
          if (!name) { sel.value = prevValue; return; }
          Store[`add${store}`](name);
          if (id === 'txCategory') this._populateCategorySelect(type, name);
          else this._populateSelect(id, Store[getter](), name);
          App._refreshConfigDependents?.();
        });
      });
    });
  },

  _handleSubmit() {
    const date = document.getElementById('txDate').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const desc = document.getElementById('txDesc').value.trim();
    const type = document.getElementById('txType').value;
    const category = document.getElementById('txCategory').value;
    const method = document.getElementById('txMethod').value;
    const account = document.getElementById('txAccount')?.value || 'checking';
    const emoji = document.getElementById('txEmoji')?.value.trim() || '';
    const transferType = document.getElementById('txTransferTypeHidden')?.value || 'to_savings';
    if (!date || !amount || amount <= 0) return;

    let data;
    if (type === 'Traspaso') {
      const isEmergency = transferType === 'from_savings_emergency';
      data = {
        date, amount,
        description: desc || (isEmergency ? 'Gasto de ahorro (imprevisto)' : 'Traspaso a ahorro'),
        type, category: 'Traspaso', paymentMethod: 'Transferencia', account: 'checking',
        transferType,
        emoji: emoji || (isEmergency ? '🆘' : '🐷'),
        _noAutoBalance: false,
      };
    } else {
      data = { date, amount, description: desc, type, category, paymentMethod: method, account };
      if (emoji) data.emoji = emoji;
    }
    let savedTxId = null;
    if (this._editingId) {
      // Traspaso: usar update normal (ya tiene shape correcta)
      Store.updateTransaction(this._editingId, data);
      savedTxId = this._editingId;
      this._editingId = null;
      document.getElementById('txSubmit').textContent = '➕ Añadir';
    } else if (type === 'Traspaso') {
      const result = Store.createAccountTransfer({
        amount,
        date,
        description: data.description,
        transferType: data.transferType,
        emoji: data.emoji,
        skipTransferLog: data.transferType === 'from_savings_emergency',
      });
      if (result === -1) {
        App.showToast(data.transferType === 'from_savings_emergency'
          ? '❌ Saldo insuficiente en ahorro'
          : '❌ Saldo insuficiente en cuenta corriente');
        return;
      }
      savedTxId = result?.id;
    } else {
      const saved = Store.addTransaction(data);
      savedTxId = saved?.id;
      if (type === 'Ingreso') {
        this._suggestSavings(amount);
      }
    }
    // Save inline debt if user filled it in (not for traspasos)
    if (type !== 'Traspaso') Deudas.saveInlineDebt('tx', savedTxId, date, desc, category);
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txDate').valueAsDate = new Date();
    const emojiInput = document.getElementById('txEmoji');
    if (emojiInput) emojiInput.value = '';
    // Reset debt block
    const debtContainer = document.getElementById('txDebtContainer');
    if (debtContainer) debtContainer.innerHTML = Deudas.inlineFormHtml('tx');
    this._editingId = null;
    document.getElementById('txSubmit').textContent = '➕ Añadir';
    this._renderWeeks();
    if (!App.isViewingArchived()) {
      Graficos.render();
      Presupuesto.render();
      Dashboard.render();
      if (document.getElementById('tab-deudas')?.classList.contains('active')) Deudas.render();
      if (document.getElementById('tab-calendario')?.classList.contains('active')) Calendario.render();
    }
  },

  _renderList() {
    const container = document.getElementById('transactionList');
    if (!container) return;
    const transactions = App.getCurrentTransactions();
    const count = document.getElementById('txCount');
    if (count) count.textContent = `${transactions.length} movimiento${transactions.length !== 1 ? 's' : ''}`;

    const filterText = (document.getElementById('txFilter')?.value || '').toLowerCase();
    const filtered = filterText ? transactions.filter(t =>
      (t.description || '').toLowerCase().includes(filterText) ||
      t.category.toLowerCase().includes(filterText) ||
      t.amount.toFixed(2).includes(filterText)
    ) : transactions;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">' + (filterText ? 'Sin resultados' : 'Aún no hay movimientos') + '</div>';
      return;
    }

    const isArchived = App.isViewingArchived();
    const allTx = App.getCurrentTransactions(); // full list for group members (even if filtered)
    const groups = Store.getTxGroups();
    const sorted = [...filtered].sort((a, b) => {
      const m = this._sortMode;
      if (m === 'date_asc')    return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (m === 'added_desc')  return b.id.localeCompare(a.id);
      if (m === 'added_asc')   return a.id.localeCompare(b.id);
      if (m === 'amount_desc') return b.amount - a.amount;
      if (m === 'amount_asc')  return a.amount - b.amount;
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });

    // Collect which groupIds have already been rendered
    const renderedGroups = new Set();

    container.innerHTML = sorted.map(t => {
      // If this tx belongs to a group, render the group card once
      if (t.groupId && groups[t.groupId]) {
        if (renderedGroups.has(t.groupId)) return '';
        renderedGroups.add(t.groupId);
        return this._renderGroupCard(t.groupId, groups[t.groupId], allTx, isArchived);
      }
      return this._renderTxRow(t, isArchived, true);
    }).join('');
  },

  _renderTxRow(t, isArchived, showGroupBtn = false) {
    const isIncome    = t.type === 'Ingreso';
    const isTraspaso  = Store.isTraspaso(t);
    const isAdjust    = Store.isAdjustment(t);
    const isExpense   = Store.isDebtExpense(t);
    const linkedDebts = Store.getDebtsByLinkedTx(t.id);
    const linkedDebt  = linkedDebts[0] || null;
    const accountLabel = { checking: '💳', savings: '🐷', cash: '💵' }[t.account] || '';
    const iconClass = isTraspaso ? 'traspaso' : isIncome ? 'income' : 'expense';
    const icon = t.emoji || (isAdjust ? '⚖' : isTraspaso ? (t.transferType === 'from_savings_emergency' ? '🆘' : '🐷') : isIncome ? '↑' : '↓');
    const amtClass  = isTraspaso ? 'traspaso' : isIncome ? 'income' : 'expense';
    const amtPrefix = isIncome ? '+' : isTraspaso ? '⇄ ' : '-';
    const debtBadge = typeof Deudas !== 'undefined' ? Deudas.debtBadgeHtml(t.id) : '';
    const pendingBadge = t._debtPending ? '<span class="tx-adj-badge" style="background:#FFFBEB;color:#D97706">pendiente</span>' : '';
    const trsLabel = isTraspaso ? (t.transferType === 'from_savings_emergency' ? '🆘→💳' : '💳→🐷') : accountLabel;
    const group = !isTraspaso && !isIncome ? Store.getCategoryGroup(t.category)
      : (!isTraspaso && isIncome ? Store.getIncomeGroup(t.category) : null);
    const groupEmoji = group?.emoji ? `<span style="font-size:11px" title="${esc(group.name)}">${group.emoji}</span>` : '';
    return `<div class="transaction-item ${isAdjust ? 'tx-adjustment' : isTraspaso ? 'tx-traspaso' : ''}" data-id="${t.id}">
      <div class="transaction-icon ${iconClass}">${icon}</div>
      <div class="transaction-info">
        <div class="transaction-desc">${esc(t.description || t.category)}${isAdjust ? ' <span class="tx-adj-badge">ajuste</span>' : ''}${isTraspaso ? ` <span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">${t.transferType === 'from_savings_emergency' ? 'imprevisto' : 'traspaso'}</span>` : ''}${pendingBadge}${debtBadge}${groupEmoji}</div>
        <div class="transaction-meta">${t.date.split('-').reverse().join('/')} · ${esc(isAdjust ? 'Ajuste bancario' : t.category)}${t.paymentMethod && !isAdjust && !isTraspaso ? ` · ${esc(t.paymentMethod)}` : ''} ${trsLabel}</div>
      </div>
      <div class="transaction-amount ${amtClass}">${amtPrefix}${t.amount.toFixed(2)}€</div>
      ${isArchived ? '' : `<div class="transaction-actions">
        ${showGroupBtn && !isAdjust ? `<button onclick="Registro._openGroupModal('${t.id}')" title="Agrupar con otros movimientos">🔗</button>` : ''}
        ${isExpense ? `<button onclick="Deudas.openLinkToTx('${t.id}')" title="${linkedDebts.length ? 'Ver/editar deudas' : 'Asociar deuda'}">💸</button>` : ''}
        <button onclick="Registro._edit('${t.id}')" title="Editar">✏️</button>
        <button onclick="Registro._delete('${t.id}')" title="Eliminar">🗑️</button>
      </div>`}
    </div>`;
  },

  _renderGroupCard(groupId, group, allTx, isArchived) {
    const members = allTx.filter(t => t.groupId === groupId);
    const expense  = members.filter(t => Store.isExpense(t)).reduce((s, t) => s + t.amount, 0);
    const income   = members.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
    const net      = expense - income;
    const dateRange = members.length > 0
      ? members[0].date.split('-').reverse().join('/')
      : '';
    return `<div class="tx-group-card">
      <div class="tx-group-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <div class="transaction-icon expense">🔗</div>
        <div class="transaction-info">
          <div class="transaction-desc">${esc(group.name)}</div>
          <div class="transaction-meta">${dateRange} · ${members.length} movimiento${members.length !== 1 ? 's' : ''} · Neto: <strong style="color:${net <= 0 ? 'var(--income)' : 'var(--expense)'}">${net >= 0 ? '' : '+'}${(-net).toFixed(2)}€</strong></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;color:var(--expense)">-${expense.toFixed(2)}€</div>
          ${income > 0 ? `<div style="font-size:12px;color:var(--income)">+${income.toFixed(2)}€</div>` : ''}
          <div style="font-size:14px;font-weight:800;color:${net <= 0 ? 'var(--income)' : 'var(--expense)'}">= ${net >= 0 ? '-' : '+'}${Math.abs(net).toFixed(2)}€</div>
        </div>
        ${isArchived ? '' : `<div class="transaction-actions" onclick="event.stopPropagation()">
          <button onclick="Registro._renameGroup('${groupId}')" title="Renombrar grupo">✏️</button>
          <button onclick="Registro._dissolveGroup('${groupId}')" title="Disolver grupo">🗑️</button>
        </div>`}
      </div>
      <div class="tx-group-members">
        ${members.sort((a,b)=>a.date.localeCompare(b.date)).map(m => {
          const isMemberIncome = m.type === 'Ingreso';
          const isMemberTrsp   = Store.isTraspaso(m);
          const cls = isMemberTrsp ? 'traspaso' : isMemberIncome ? 'income' : 'expense';
          const pfx = isMemberIncome ? '+' : isMemberTrsp ? '⇄ ' : '-';
          return `<div class="tx-group-member-row">
            <div class="transaction-icon ${cls}" style="width:22px;height:22px;font-size:11px;flex-shrink:0">${isMemberTrsp?'⇄':isMemberIncome?'↑':'↓'}</div>
            <div class="transaction-info">
              <div style="font-size:13px;font-weight:600">${esc(m.description || m.category)}</div>
              <div style="font-size:11px;color:var(--text-secondary)">${m.date.split('-').reverse().join('/')} · ${esc(m.category)}</div>
            </div>
            <div class="transaction-amount ${cls}" style="font-size:13px">${pfx}${m.amount.toFixed(2)}€</div>
            ${isArchived ? '' : `<div class="transaction-actions">
              <button onclick="Registro._removeFromGroup('${m.id}')" title="Sacar del grupo">✂️</button>
              <button onclick="Registro._edit('${m.id}')" title="Editar">✏️</button>
              <button onclick="Registro._delete('${m.id}')" title="Eliminar">🗑️</button>
            </div>`}
          </div>`;
        }).join('')}
        ${isArchived ? '' : `<button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%" onclick="Registro._addToExistingGroup('${groupId}')">➕ Añadir movimiento al grupo</button>`}
      </div>
    </div>`;
  },

  _openGroupModal(txId) {
    const t = Store.getTransactions().find(x => x.id === txId);
    if (!t) return;
    const allTx = App.getCurrentTransactions()
      .filter(x => x.id !== txId && !x.groupId && !Store.isAdjustment(x))
      .sort((a, b) => Math.abs(new Date(a.date) - new Date(t.date)) - Math.abs(new Date(b.date) - new Date(t.date)));

    App.openModal({
      title: '🔗 Agrupar movimiento',
      body: `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Crea un grupo para ver el coste neto (p.ej. pagaste tú y luego te devolvieron por Bizum).</p>
        <div class="form-group">
          <label>Nombre del grupo</label>
          <input type="text" id="grpName" value="${esc(t.description || t.category)}" placeholder="Ej: Cena bar amigos" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group">
          <label>Selecciona movimientos a incluir</label>
          <input type="text" id="grpSearch" placeholder="🔍 Buscar..." oninput="Registro._filterGrpList('grpTxList', this.value)"
            style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:4px">
          <div id="grpTxList" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">
            ${allTx.length === 0
              ? '<div style="font-size:13px;color:var(--text-secondary);padding:8px">No hay otros movimientos disponibles</div>'
              : allTx.map(x => `<label class="grp-tx-item" style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:6px" data-search="${(x.description||x.category).toLowerCase()} ${x.amount.toFixed(2)} ${x.date}">
                  <input type="checkbox" value="${x.id}" style="flex-shrink:0">
                  <span style="flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.description || x.category)}</span>
                  <span style="font-size:13px;font-weight:600;white-space:nowrap;color:${x.type==='Ingreso'?'var(--income)':'var(--expense)'}">${x.type==='Ingreso'?'+':'-'}${x.amount.toFixed(2)}€</span>
                  <span style="font-size:11px;color:var(--text-secondary);white-space:nowrap">${x.date.split('-').reverse().join('/')}</span>
                </label>`).join('')}
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${allTx.length} movimiento${allTx.length!==1?'s':''} disponibles</div>
        </div>`,
      actions: [
        { label: 'Cancelar' },
        { label: '🔗 Crear grupo', primary: true, cb: () => {
          const name = document.getElementById('grpName')?.value.trim();
          if (!name) { App.showToast('Escribe un nombre'); return; }
          const checked = [...document.querySelectorAll('#grpTxList input:checked')].map(el => el.value);
          const gid = Store.createTxGroup(name);
          Store.setTxGroup(txId, gid);
          checked.forEach(id => Store.setTxGroup(id, gid));
          Registro.render();
          App.showToast('Grupo creado');
        }},
      ],
    });
  },

  _filterGrpList(listId, query) {
    const q = query.toLowerCase();
    document.querySelectorAll(`#${listId} .grp-tx-item`).forEach(el => {
      el.style.display = !q || el.dataset.search.includes(q) ? '' : 'none';
    });
  },

  _addToExistingGroup(groupId) {
    const allTx = App.getCurrentTransactions()
      .filter(t => !t.groupId && !Store.isAdjustment(t))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (allTx.length === 0) { App.showToast('No hay movimientos sin grupo'); return; }
    App.openModal({
      title: '➕ Añadir al grupo',
      body: `
        <input type="text" id="addGrpSearch" placeholder="🔍 Buscar..." oninput="Registro._filterGrpList('addGrpList', this.value)"
          style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:4px">
        <div id="addGrpList" style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">
          ${allTx.map(x => `<label class="grp-tx-item" style="display:flex;align-items:center;gap:8px;padding:6px;cursor:pointer;border-radius:6px" data-search="${(x.description||x.category).toLowerCase()} ${x.amount.toFixed(2)} ${x.date}">
            <input type="checkbox" value="${x.id}" style="flex-shrink:0">
            <span style="flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.description || x.category)}</span>
            <span style="font-size:13px;font-weight:600;white-space:nowrap;color:${x.type==='Ingreso'?'var(--income)':'var(--expense)'}">${x.type==='Ingreso'?'+':'-'}${x.amount.toFixed(2)}€</span>
            <span style="font-size:11px;color:var(--text-secondary);white-space:nowrap">${x.date.split('-').reverse().join('/')}</span>
          </label>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${allTx.length} movimiento${allTx.length!==1?'s':''} disponibles</div>`,
      actions: [
        { label: 'Cancelar' },
        { label: '➕ Añadir', primary: true, cb: () => {
          const checked = [...document.querySelectorAll('#addGrpList input:checked')].map(el => el.value);
          if (checked.length === 0) { App.showToast('Selecciona al menos uno'); return; }
          checked.forEach(id => Store.setTxGroup(id, groupId));
          Registro.render();
          App.showToast('Movimientos añadidos al grupo');
        }},
      ],
    });
  },

  _removeFromGroup(txId) {
    Store.setTxGroup(txId, null);
    Registro.render();
  },

  _renameGroup(groupId) {
    const group = Store.getTxGroups()[groupId];
    if (!group) return;
    App.showPrompt('Renombrar grupo', 'Nuevo nombre:', group.name, (name) => {
      if (name) { Store.renameTxGroup(groupId, name); Registro.render(); }
    });
  },

  _dissolveGroup(groupId) {
    App.showConfirm('Disolver grupo', '¿Disolver el grupo? Los movimientos quedarán sueltos.', () => {
      Store.deleteTxGroup(groupId);
      Registro.render();
    });
  },

  _edit(id) {
    const t = Store.getTransactions().find(tx => tx.id === id);
    if (!t) return;
    this._editingId = id;
    document.getElementById('txDate').value = t.date;
    document.getElementById('txAmount').value = t.amount;
    document.getElementById('txDesc').value = t.description || '';
    document.getElementById('txType').value = t.type;
    this._populateCategorySelect(t.type, t.category);
    this._populateSelect('txMethod', Store.getPaymentMethods(), t.paymentMethod || '');
    document.getElementById('txMethod').value = t.paymentMethod || '';
    const accEl = document.getElementById('txAccount');
    if (accEl) accEl.value = t.account || (t.paymentMethod === 'Efectivo' ? 'cash' : 'checking');
    const emojiEl = document.getElementById('txEmoji');
    if (emojiEl) emojiEl.value = t.emoji || '';
    this._toggleTraspasoMode(t.type);
    // Restore transfer subtype when editing a Traspaso
    if (t.type === 'Traspaso') {
      this._setTransferType(t.transferType || 'to_savings');
    }
    document.getElementById('txSubmit').textContent = '💾 Guardar';
    const debtContainer = document.getElementById('txDebtContainer');
    if (debtContainer && typeof Deudas !== 'undefined') {
      if (t.type === 'Gasto') {
        debtContainer.innerHTML = Deudas.inlineFormHtml('tx', t.amount, t.description || '', null, Store.getDebtsByLinkedTx(id));
      } else {
        debtContainer.innerHTML = '';
      }
    }
    document.getElementById('tab-registro')?.scrollIntoView({ behavior: 'smooth' });
  },

  _delete(id) {
    const t = Store.getTransactions().find(tx => tx.id === id);
    if (!t) return;
    App.showConfirm('Eliminar', `¿Eliminar "${t.description || t.category}" (${t.amount.toFixed(2)} €)?`, () => {
      Store.deleteTransaction(id);
      this._renderWeeks(); Graficos.render(); Presupuesto.render(); Dashboard.render();
    });
  },

  _showImport() {
    const body = `<div style="margin-bottom:12px">
      <input type="file" id="csvFile" accept=".csv,.tsv,.txt" style="width:100%">
      <div style="font-size:12px;color:var(--text-secondary);background:var(--bg);padding:8px;border-radius:6px;margin-top:8px">Formatos: CSV, TSV (coma, punto y coma, tabulador). Detección automática de columnas.</div>
    </div>
    <div id="importPreview" style="max-height:200px;overflow:auto;font-size:12px"></div>
    <div id="importMapping" style="display:none;margin-top:8px">
      <div id="mapFields" style="display:flex;flex-direction:column;gap:6px"></div>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="Registro._doImport()">Importar</button>
    </div>`;
    App.showCustom('Importar CSV', body, 'Cerrar', () => {});
    document.getElementById('csvFile').addEventListener('change', (e) => this._parseCSV(e));
  },

  _parseCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const delim = this._detectDelimiter(text);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { alert('El archivo debe tener cabecera + datos'); return; }
        const headers = this._parseLine(lines[0], delim);
        const rows = lines.slice(1).filter(l => l.trim()).map(l => this._parseLine(l, delim));
        document.getElementById('importPreview').innerHTML = `
          <div style="font-weight:600;margin-bottom:4px;font-size:12px">${rows.length} filas, ${headers.length} columnas</div>
          <table><tr>${headers.map(h => `<th style="border:1px solid var(--border);padding:4px;font-size:11px">${esc(h)}</th>`).join('')}</tr>
          ${rows.slice(0,5).map(r => `<tr>${r.map(c => `<td style="border:1px solid var(--border);padding:4px;font-size:11px">${esc(c)}</td>`).join('')}</tr>`).join('')}
          ${rows.length > 5 ? `<tr><td colspan="${headers.length}" style="padding:4px;font-size:11px;color:var(--text-secondary)">... y ${rows.length-5} más</td></tr>` : ''}
        </table>`;
        this._csvData = { headers, rows, delim };
        this._showMapping(headers);
      } catch (err) { alert('Error: ' + err.message); }
    };
    reader.readAsText(file, 'utf-8');
  },

  _detectDelimiter(text) {
    const l = text.split(/\r?\n/)[0];
    const sc = (l.match(/;/g) || []).length;
    const cm = (l.match(/,/g) || []).length;
    const tb = (l.match(/\t/g) || []).length;
    if (tb > cm && tb > sc) return '\t';
    return sc > cm ? ';' : ',';
  },

  _parseLine(line, delim) {
    const r = []; let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === delim && !q) { r.push(c.trim()); c = ''; continue; }
      c += ch;
    }
    r.push(c.trim());
    return r;
  },

  _showMapping(headers) {
    const mapDiv = document.getElementById('importMapping');
    const fieldsDiv = document.getElementById('mapFields');
    mapDiv.style.display = 'block';
    const appFields = [
      { value: 'date', label: 'Fecha' }, { value: 'amount', label: 'Importe' },
      { value: 'description', label: 'Descripción' }, { value: 'category', label: 'Categoría' },
      { value: 'type', label: 'Tipo' }, { value: 'paymentMethod', label: 'Pago' }, { value: '__skip__', label: 'Ignorar' }
    ];
    const autoMap = {};
    const lh = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    for (let i = 0; i < headers.length; i++) {
      if (['fecha','date','fecha operacion','fecha_operacion'].some(k => lh[i].includes(k))) autoMap[i] = 'date';
      else if (['importe','amount','cantidad','valor','total','euros'].some(k => lh[i].includes(k))) autoMap[i] = 'amount';
      else if (['descripcion','description','concepto','concept','detalle'].some(k => lh[i].includes(k))) autoMap[i] = 'description';
      else autoMap[i] = '__skip__';
    }
    fieldsDiv.innerHTML = headers.map((h, i) => `
      <div style="display:flex;gap:8px;align-items:center">
        <span style="min-width:80px;font-size:12px;font-weight:500">${esc(h)}</span>
        <select data-col="${i}" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:4px;font-size:12px">
          ${appFields.map(f => `<option value="${f.value}" ${(autoMap[i]||'__skip__')===f.value?'selected':''}>${f.label}</option>`).join('')}
        </select>
      </div>`).join('');
  },

  _doImport() {
    if (!this._csvData) return;
    const { headers, rows } = this._csvData;
    const selects = document.querySelectorAll('#mapFields select');
    const mapping = {};
    selects.forEach(sel => { mapping[sel.value] = parseInt(sel.dataset.col); });
    if (mapping.date === undefined || mapping.amount === undefined) { alert('Debes mapear Fecha e Importe'); return; }
    const added = []; const errors = [];
    rows.forEach((row, idx) => {
      try {
        const rawDate = row[mapping.date] || '';
        const rawAmount = (row[mapping.amount] || '').replace(/[^0-9,\-\.]/g, '').replace(',', '.');
        const amount = parseFloat(rawAmount);
        if (!rawDate || isNaN(amount) || amount <= 0) { errors.push(`Fila ${idx+2}: inválida`); return; }
        const date = parseISODate(rawDate);
        const description = mapping.description !== undefined ? (row[mapping.description] || '') : '';
        let category = mapping.category !== undefined ? (row[mapping.category] || 'Otros') : 'Otros';
        let type = mapping.type !== undefined ? (row[mapping.type] || '') : '';
        type = type.toLowerCase().includes('ingr') || type.toLowerCase().includes('income') ? 'Ingreso' : 'Gasto';
        const catList = Store.getCategoriesForType(type);
        if (!catList.includes(category)) category = type === 'Ingreso' ? 'Extra' : 'Otros';
        let pm = mapping.paymentMethod !== undefined ? (row[mapping.paymentMethod] || '') : '';
        if (pm && !Store.getPaymentMethods().includes(pm)) pm = '';
        added.push({ date, amount, description, category, type, paymentMethod: pm });
      } catch {}
    });
    if (added.length === 0) { alert('No se pudieron importar movimientos' + (errors.length ? '\n' + errors.slice(0,5).join('\n') : '')); return; }
    App.showConfirm('Importar', `Se importarán ${added.length} movimiento${added.length !== 1 ? 's' : ''}${errors.length ? `. ${errors.length} omitidos.` : ''}`, () => {
      const expenseCatSet = new Set(Store.getCategories());
      const incomeCatSet = new Set(Store.getIncomeCategories());
      added.forEach(t => {
        if (t.type === 'Ingreso') {
          if (!incomeCatSet.has(t.category)) { Store.addIncomeCategory(t.category); incomeCatSet.add(t.category); }
        } else if (!expenseCatSet.has(t.category)) {
          Store.addCategory(t.category);
          expenseCatSet.add(t.category);
        }
      });
      Store.addTransactions(added);
      App._renderMonthSelector();
      App._refreshAll();
      this._csvData = null;
      alert(`${added.length} importado${added.length !== 1 ? 's' : ''}`);
    });
  },

  _toggleCollapse(id) {
    const body = document.getElementById(id);
    const arrow = document.getElementById('arr-' + id);
    if (!body) return;
    const collapsed = body.classList.toggle('collapsed');
    if (arrow) arrow.textContent = collapsed ? '▸' : '▾';
  },

  // Delegate to the shared suggestSavings helper in App so it works from FAB too
  _suggestSavings(incomeAmount) { App.suggestSavings(incomeAmount); },

  _renderWeeks() {
    const grid = document.getElementById('weekGrid');
    const monthLabel = document.getElementById('semanasMonth');
    if (!grid) return;

    const transactions = App.getCurrentTransactions().filter(t => !Store.isAdjustment(t));
    const month = App.getCurrentViewMonth();
    const [year, m] = month.split('-').map(Number);

    if (monthLabel) monthLabel.textContent = `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m-1]} ${year}`;

    const firstDay = new Date(year, m - 1, 1);
    const lastDay = new Date(year, m, 0);
    const weeks = [];
    let cur = new Date(firstDay);
    const dow = cur.getDay();
    cur.setDate(cur.getDate() + (dow === 0 ? -6 : 1 - dow));
    cur.setHours(0, 0, 0, 0);
    let guard = 6;
    while (guard-- > 0) {
      const end = new Date(cur); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
      if (cur > lastDay) break;
      weeks.push({
        start: new Date(cur), end: new Date(end),
        startDisplay: new Date(Math.max(cur.getTime(), firstDay.getTime())),
        endDisplay:   new Date(Math.min(end.getTime(), lastDay.getTime())),
      });
      cur.setDate(cur.getDate() + 7);
    }

    const fmt       = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    const dayNames  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const isArchived = App.isViewingArchived();
    const allGroups  = Store.getTxGroups();

    // Helper: render one tx row inside weekly view
    const renderTxRow = (t) => {
      const isIncome = t.type === 'Ingreso';
      const isTrsp   = Store.isTraspaso(t);
      const linkedDebts = Store.getDebtsByLinkedTx(t.id);
      const cls      = isTrsp ? 'traspaso' : isIncome ? 'income' : 'expense';
      const pfx      = isIncome ? '+' : isTrsp ? '⇄ ' : '-';
      const debtBadge = typeof Deudas !== 'undefined' ? Deudas.debtBadgeHtml(t.id) : '';
      const txIcon = t.emoji || (isTrsp ? (t.transferType === 'from_savings_emergency' ? '🆘' : '🐷') : isIncome ? '↑' : '↓');
      return `<div class="week-tx-row">
        <div class="transaction-icon ${cls}" style="width:22px;height:22px;font-size:11px;flex-shrink:0">${txIcon}</div>
        <div class="week-tx-info">
          <div class="week-tx-desc">${esc(t.description || t.category)}${debtBadge}</div>
          <div class="week-tx-meta">${esc(t.category)}${t.paymentMethod && !isTrsp ? ' · '+esc(t.paymentMethod) : ''}</div>
        </div>
        <span class="transaction-amount ${cls}" style="font-size:13px;white-space:nowrap">${pfx}${t.amount.toFixed(2)}€</span>
        ${!isArchived ? `<div class="cal-tx-actions">
          <button title="Agrupar" onclick="Registro._openGroupModal('${t.id}')">🔗</button>
          ${Store.isDebtExpense(t) ? `<button title="${linkedDebts.length ? 'Editar deudas' : 'Asociar deuda'}" onclick="Deudas.openLinkToTx('${t.id}')">💸</button>` : ''}
          <button title="Editar" onclick="Registro._edit('${t.id}');document.getElementById('tab-registro').scrollIntoView({behavior:'smooth'})">✏️</button>
          <button title="Eliminar" onclick="Registro._delete('${t.id}')">🗑️</button>
        </div>` : ''}
      </div>`;
    };

    // Helper: render a group card inside weekly view
    const renderGroupCard = (groupId, group, members) => {
      const expense = members.filter(t => Store.isExpense(t)).reduce((s,t) => s+t.amount, 0);
      const income  = members.filter(t => t.type === 'Ingreso').reduce((s,t) => s+t.amount, 0);
      const net     = expense - income;
      return `<div class="tx-group-card" style="margin:4px 0">
        <div class="tx-group-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <div class="transaction-icon expense" style="width:22px;height:22px;font-size:11px;flex-shrink:0">🔗</div>
          <div class="transaction-info">
            <div class="transaction-desc" style="font-size:13px">${esc(group.name)}</div>
            <div class="transaction-meta">neto: <strong style="color:${net<=0?'var(--income)':'var(--expense)'}">${net>=0?'-':'+'}${Math.abs(net).toFixed(2)}€</strong></div>
          </div>
          <div style="text-align:right;flex-shrink:0;font-size:12px">
            <div style="color:var(--expense)">-${expense.toFixed(2)}€</div>
            ${income>0?`<div style="color:var(--income)">+${income.toFixed(2)}€</div>`:''}
          </div>
          ${!isArchived ? `<div class="transaction-actions" onclick="event.stopPropagation()">
            <button onclick="Registro._addToExistingGroup('${groupId}')" title="Añadir al grupo">➕</button>
            <button onclick="Registro._renameGroup('${groupId}')" title="Renombrar">✏️</button>
            <button onclick="Registro._dissolveGroup('${groupId}')" title="Disolver">🗑️</button>
          </div>` : ''}
        </div>
        <div class="tx-group-members hidden">
          ${members.map(m => {
            const isIncome = m.type === 'Ingreso';
            const isTrsp   = Store.isTraspaso(m);
            const cls      = isTrsp ? 'traspaso' : isIncome ? 'income' : 'expense';
            const pfx      = isIncome ? '+' : isTrsp ? '⇄ ' : '-';
            const mIcon    = m.emoji || (isTrsp ? (m.transferType === 'from_savings_emergency' ? '🆘' : '🐷') : isIncome ? '↑' : '↓');
            return `<div class="tx-group-member-row">
              <div class="transaction-icon ${cls}" style="width:20px;height:20px;font-size:10px;flex-shrink:0">${mIcon}</div>
              <div class="transaction-info"><div style="font-size:12px;font-weight:600">${esc(m.description||m.category)}</div><div style="font-size:11px;color:var(--text-secondary)">${m.date.split('-').reverse().join('/')}</div></div>
              <span class="transaction-amount ${cls}" style="font-size:12px;white-space:nowrap">${pfx}${m.amount.toFixed(2)}€</span>
              ${!isArchived ? `<div class="transaction-actions">
                <button onclick="Registro._removeFromGroup('${m.id}')" title="Sacar">✂️</button>
                <button onclick="Registro._edit('${m.id}');document.getElementById('tab-registro').scrollIntoView({behavior:'smooth'})">✏️</button>
                <button onclick="Registro._delete('${m.id}')">🗑️</button>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    };

    grid.innerHTML = weeks.map((week, idx) => {
      const weekTx = transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d >= week.start && d <= week.end;
      });
      const income   = weekTx.filter(t => t.type === 'Ingreso').reduce((s, t) => s + t.amount, 0);
      const expense  = weekTx.filter(t => Store.isExpense(t)).reduce((s, t) => s + t.amount, 0);
      const traspaso = weekTx.filter(t => Store.isTraspaso(t)).reduce((s, t) => s + t.amount, 0);
      const balance  = income - expense;

      // Build sorted list of days that have transactions
      const dayMap = {};
      weekTx.forEach(t => { (dayMap[t.date] = dayMap[t.date] || []).push(t); });
      const days = Object.keys(dayMap).sort();

      const daysHtml = days.map(dateStr => {
        const dayTxs = dayMap[dateStr].sort((a,b) => a.type === 'Ingreso' ? -1 : 1);
        const d = new Date(dateStr + 'T12:00:00');
        const dayLabel = `${dayNames[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
        const dayIncome  = dayTxs.filter(t => t.type === 'Ingreso').reduce((s,t) => s+t.amount, 0);
        const dayExpense = dayTxs.filter(t => Store.isExpense(t)).reduce((s,t) => s+t.amount, 0);
        const renderedGrps = new Set();

        const txRows = dayTxs.map(t => {
          if (t.groupId && allGroups[t.groupId]) {
            if (renderedGrps.has(t.groupId)) return '';
            renderedGrps.add(t.groupId);
            const members = weekTx.filter(x => x.groupId === t.groupId);
            return renderGroupCard(t.groupId, allGroups[t.groupId], members);
          }
          return renderTxRow(t);
        }).join('');

        const dayId = `day-${dateStr}`;
        return `<div class="week-day-block">
          <div class="week-day-header" onclick="Registro._toggleCollapse('${dayId}')" style="cursor:pointer">
            <span class="week-day-label">${dayLabel}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <span class="week-day-totals">
                ${dayIncome > 0 ? `<span class="income">+${dayIncome.toFixed(2)}€</span>` : ''}
                ${dayExpense > 0 ? `<span class="expense">-${dayExpense.toFixed(2)}€</span>` : ''}
              </span>
              <span class="collapse-arrow" id="arr-${dayId}">▾</span>
            </span>
          </div>
          <div id="${dayId}" class="collapsible-body">
            ${txRows}
          </div>
        </div>`;
      }).join('');

      const weekId = `week-${idx}`;
      return `<div class="week-card">
        <div class="week-header" onclick="Registro._toggleCollapse('${weekId}')" style="cursor:pointer">
          <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
            <span style="font-size:13px;font-weight:700">Semana ${idx + 1}: ${fmt(week.startDisplay)} – ${fmt(week.endDisplay)}</span>
            <span style="display:flex;gap:6px;flex-wrap:wrap;font-size:11px">
              ${income > 0 ? `<span style="color:var(--income);font-weight:600">+${income.toFixed(2)}€</span>` : ''}
              ${expense > 0 ? `<span style="color:var(--expense);font-weight:600">-${expense.toFixed(2)}€</span>` : ''}
              ${(income > 0 || expense > 0) ? `<span style="color:${balance >= 0 ? 'var(--income)' : 'var(--expense)'};font-weight:700">${balance >= 0 ? '=' : '='}${balance >= 0 ? '+' : ''}${balance.toFixed(2)}€</span>` : ''}
              ${traspaso > 0 ? `<span style="color:#4F46E5;font-weight:600">⇄${traspaso.toFixed(2)}€</span>` : ''}
            </span>
          </div>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <span style="font-weight:600;font-size:12px;color:var(--text-secondary)">${weekTx.length} mov.</span>
            <span class="collapse-arrow" id="arr-${weekId}">▾</span>
          </span>
        </div>
        <div id="${weekId}" class="collapsible-body">
          <div class="week-stats">
            <div class="week-stat"><div class="week-stat-label">Ingresos</div><div class="week-stat-value income">+${income.toFixed(2)} €</div></div>
            <div class="week-stat"><div class="week-stat-label">Gastos</div><div class="week-stat-value expense">-${expense.toFixed(2)} €</div></div>
            <div class="week-stat"><div class="week-stat-label">Balance</div><div class="week-stat-value" style="color:${balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${balance >= 0 ? '+' : ''}${balance.toFixed(2)} €</div></div>
            ${traspaso > 0 ? `<div class="week-stat"><div class="week-stat-label">Traspasos</div><div class="week-stat-value" style="color:#4F46E5">⇄ ${traspaso.toFixed(2)} €</div></div>` : ''}
          </div>
          ${days.length > 0 ? daysHtml : '<div style="font-size:13px;color:var(--text-secondary);padding:6px 0">Sin movimientos esta semana</div>'}
        </div>
      </div>`;
    }).join('');
  },
};
