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
        <form id="txForm" class="form-grid" style="grid-template-columns:1fr 1fr 1fr">
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
              <option value="cash">💵 Efectivo (no computa)</option>
            </select>
          </div>
        </form>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="txSubmit" form="txForm">➕ Añadir</button>
        </div>
        `}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Movimientos</span>
          <span id="txCount" style="font-size:12px;color:var(--text-secondary)"></span>
        </div>
        <div id="txSearch" style="margin-bottom:8px">
          <input type="text" id="txFilter" placeholder="🔍 Buscar..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:6px">
          <div style="display:flex;gap:4px;flex-wrap:wrap" id="sortBtns">
            ${[['date_desc','📅 Reciente'],['date_asc','📅 Antiguo'],['added_desc','🕐 Añadido'],['amount_desc','💶 Mayor'],['amount_asc','💶 Menor']].map(([m,l])=>`<button class="tx-sort-btn${this._sortMode===m?' active':''}" onclick="Registro._setSort('${m}')">${l}</button>`).join('')}
          </div>
        </div>
        <div id="transactionList" class="transaction-list"></div>
      </div>
    `;
    if (!isArchived) this._initForm();
    this._renderList();
    const filter = document.getElementById('txFilter');
    if (filter) filter.addEventListener('input', () => this._renderList());
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
    document.getElementById('txType').addEventListener('change', (e) => {
      const type = e.target.value;
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
    if (!date || !amount || amount <= 0) return;

    const data = { date, amount, description: desc, type, category, paymentMethod: method, account };
    if (this._editingId) {
      Store.updateTransaction(this._editingId, data);
      this._editingId = null;
      document.getElementById('txSubmit').textContent = '➕ Añadir';
    } else {
      Store.addTransaction(data);
      if (type === 'Ingreso') {
        this._suggestSavings(amount);
      }
    }
    document.getElementById('txAmount').value = '';
    document.getElementById('txDesc').value = '';
    document.getElementById('txDate').valueAsDate = new Date();
    this._renderList();
    if (!App.isViewingArchived()) {
      Semanas.render();
      Graficos.render();
      Presupuesto.render();
      Dashboard.render();
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
    const sorted = [...filtered].sort((a, b) => {
      const m = this._sortMode;
      if (m === 'date_asc')    return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      if (m === 'added_desc')  return b.id.localeCompare(a.id);
      if (m === 'added_asc')   return a.id.localeCompare(b.id);
      if (m === 'amount_desc') return b.amount - a.amount;
      if (m === 'amount_asc')  return a.amount - b.amount;
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); // date_desc (default)
    });
    container.innerHTML = sorted.map(t => {
      const isIncome = t.type === 'Ingreso';
      const isAdjust = Store.isAdjustment(t);
      const accountLabel = { checking: '💳', savings: '🐷', cash: '💵' }[t.account] || '';
      return `<div class="transaction-item ${isAdjust ? 'tx-adjustment' : ''}" data-id="${t.id}">
        <div class="transaction-icon ${isIncome ? 'income' : 'expense'}">${isAdjust ? '⚖' : isIncome ? '↑' : '↓'}</div>
        <div class="transaction-info">
          <div class="transaction-desc">${esc(t.description || t.category)}${isAdjust ? ' <span class="tx-adj-badge">ajuste</span>' : ''}</div>
          <div class="transaction-meta">${t.date.split('-').reverse().join('/')} · ${esc(isAdjust ? 'Ajuste bancario' : t.category)}${t.paymentMethod && !isAdjust ? ` · ${esc(t.paymentMethod)}` : ''} ${accountLabel}</div>
        </div>
        <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${t.amount.toFixed(2)}€</div>
        ${isArchived ? '' : `<div class="transaction-actions">
          <button onclick="Registro._edit('${t.id}')" title="Editar">✏️</button>
          <button onclick="Registro._delete('${t.id}')" title="Eliminar">🗑️</button>
        </div>`}
      </div>`;
    }).join('');
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
    document.getElementById('txSubmit').textContent = '💾 Guardar';
  },

  _delete(id) {
    const t = Store.getTransactions().find(tx => tx.id === id);
    if (!t) return;
    App.showConfirm('Eliminar', `¿Eliminar "${t.description || t.category}" (${t.amount.toFixed(2)} €)?`, () => {
      Store.deleteTransaction(id);
      this._renderList();
      Semanas.render(); Graficos.render(); Presupuesto.render(); Dashboard.render();
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

  // Delegate to the shared suggestSavings helper in App so it works from FAB too
  _suggestSavings(incomeAmount) { App.suggestSavings(incomeAmount); },
};
