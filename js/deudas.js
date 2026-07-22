const Deudas = {
  viewMode: { owed: 'debt', iowe: 'debt', main: 'net' },
  scope: 'personal',          // 'personal' | 'shared'
  _collapsedGroups: new Set(),
  _collapsedPersons: new Set(),
  _collapsedNetPersons: new Set(),

  _setViewMode(section, mode) {
    this.viewMode[section] = mode;
    this.render();
  },

  // ── Scope helpers — route operations to personal or shared store ──────────
  _setScope(s) { this.scope = s; this.render(); },

  _getPendingDebts()  { return this.scope === 'shared' ? Store.getPendingSharedDebts()  : Store.getPendingDebts(); },
  _getSettledDebts()  { return this.scope === 'shared' ? Store.getSettledSharedDebts()  : Store.getSettledDebts(); },
  _getDebts()         { return this.scope === 'shared' ? Store.getSharedDebts()         : Store.getDebts(); },

  _scopeAddDebtsForPeople(opts) {
    return this.scope === 'shared'
      ? Store.addSharedDebtsForPeople(opts)
      : Store.addDebtsForPeople(opts);
  },

  _scopeDeleteDebt(id) {
    if (this.scope === 'shared') Store.deleteSharedDebt(id);
    else Store.deleteDebt(id);
  },

  _scopeSettleDebt(id) {
    if (this.scope === 'shared') { Store.settleSharedDebt(id); return null; }
    return Store.settleDebt(id);
  },

  _scopeReopenDebt(id) {
    if (this.scope === 'shared') Store.reopenSharedDebt(id);
    else Store.updateDebt(id, { isPaid: false, paidDate: null, paidTxId: null });
  },

  _scopeUpdateDebt(id, patch) {
    if (this.scope === 'shared') Store.updateSharedDebt(id, patch);
    else Store.updateDebt(id, patch);
  },

  _scopeGetNetBalance(person)   { return this.scope === 'shared' ? Store.getSharedNetBalance(person) : Store.getNetBalance(person); },
  _scopeSettlePersonNet(person) {
    if (this.scope === 'shared') { Store.settleSharedPersonNet(person); return null; }
    return Store.settlePersonNet(person);
  },

  _scopeSave() {
    if (this.scope !== 'shared') Store._save();
  },

  _scopeGetPeople() { return Store.getPeople(); },

  _setMainView(mode) {
    this.viewMode.main = mode;
    this.render();
  },

  _toggleNetPerson(person) {
    const key = `net:${person}`;
    if (this._collapsedNetPersons.has(key)) this._collapsedNetPersons.delete(key);
    else this._collapsedNetPersons.add(key);
    this.render();
  },

  /**
   * Calcula el balance neto por persona, combinando Me deben + Debo yo.
   * Devuelve array ordenado por |net| desc.
   * Usa _getPendingDebts() para respetar el scope actual (personal / compartido).
   */
  _buildNetBalances() {
    const pending = this._getPendingDebts();
    const map = new Map();
    for (const d of pending) {
      if (!map.has(d.person)) map.set(d.person, { person: d.person, owedToMe: [], iOwe: [] });
      const entry = map.get(d.person);
      if ((d.type || 'owed_to_me') === 'owed_to_me') entry.owedToMe.push(d);
      else entry.iOwe.push(d);
    }
    return [...map.values()].map(e => {
      const totalOwed = e.owedToMe.reduce((s, d) => s + d.amount, 0);
      const totalIOwe = e.iOwe.reduce((s, d) => s + d.amount, 0);
      e.net = Math.round((totalOwed - totalIOwe) * 100) / 100;
      return e;
    }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  },

  _toggleGroup(key) {
    if (this._collapsedGroups.has(key)) this._collapsedGroups.delete(key);
    else this._collapsedGroups.add(key);
    this.render();
  },

  _togglePerson(key) {
    if (this._collapsedPersons.has(key)) this._collapsedPersons.delete(key);
    else this._collapsedPersons.add(key);
    this.render();
  },

  _debtGroupKey(d) {
    if (d.splitGroupId) return `g:${d.splitGroupId}`;
    if (d.linkedTxId) return `t:${d.linkedTxId}:${d.type || 'owed_to_me'}`;
    return `d:${d.id}`;
  },

  _buildDebtGroups(debts) {
    const map = new Map();
    for (const d of debts) {
      const key = this._debtGroupKey(d);
      if (!map.has(key)) map.set(key, { key, debts: [] });
      map.get(key).debts.push(d);
    }
    const groups = [...map.values()];
    for (const g of groups) {
      g.debts.sort((a, b) => a.person.localeCompare(b.person, 'es'));
      g.total = g.debts.reduce((s, d) => s + d.amount, 0);
      g.primary = g.debts[0];
      g.date = g.primary.date || '';
      g.description = g.primary.description || g.primary.category || 'Sin descripción';
      g.category = g.primary.category || '';
      g.linkedTxId = g.primary.linkedTxId || null;
      g.splitCount = g.primary.splitCount || null;
      g.totalAmount = g.primary.totalAmount || null;
    }
    return groups.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  },

  _aggregateByPerson(debts) {
    const map = new Map();
    for (const d of debts) {
      if (!map.has(d.person)) map.set(d.person, { person: d.person, debts: [], total: 0 });
      const entry = map.get(d.person);
      entry.debts.push(d);
      entry.total += d.amount;
    }
    return [...map.values()]
      .map(entry => {
        entry.debts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return entry;
      })
      .sort((a, b) => b.total - a.total || a.person.localeCompare(b.person, 'es'));
  },

  _personKey(person, isOwedToMe) {
    return `${isOwedToMe ? 'owed' : 'iowe'}:${person}`;
  },

  _dateMeta(dateStr) {
    if (!dateStr) return { dateLabel: '', daysAgo: 0, urgency: 'color:var(--text-secondary)' };
    const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' });
    const daysAgo = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000);
    const urgency = daysAgo > 30 ? 'color:var(--expense)' : daysAgo > 14 ? 'color:#F59E0B' : 'color:var(--text-secondary)';
    return { dateLabel, daysAgo, urgency };
  },

  _viewToggleHtml(section, currentMode) {
    return `
      <div class="debt-view-toggle">
        <button type="button" class="cal-type-btn${currentMode === 'debt' ? ' active' : ''}" onclick="Deudas._setViewMode('${section}','debt')">📋 Por deuda</button>
        <button type="button" class="cal-type-btn${currentMode === 'person' ? ' active' : ''}" onclick="Deudas._setViewMode('${section}','person')">👤 Por persona</button>
      </div>`;
  },

  _mainViewToggleHtml() {
    const mode = this.viewMode.main;
    return `
      <div class="debt-view-toggle" style="margin-bottom:12px">
        <button type="button" class="cal-type-btn${mode === 'net' ? ' active' : ''}" onclick="Deudas._setMainView('net')">⚖️ Balance neto</button>
        <button type="button" class="cal-type-btn${mode === 'legacy' ? ' active' : ''}" onclick="Deudas._setMainView('legacy')">📋 Por tipo</button>
      </div>`;
  },

  _renderNetPersonCard(entry) {
    const key = `net:${entry.person}`;
    const expanded = !this._collapsedNetPersons.has(key);
    const net = entry.net;
    const isPositive = net > 0;
    const isZero = Math.abs(net) < 0.01;
    const safePerson = entry.person.replace(/'/g, "\\'");

    let netLabel, netClass, settleLabel;
    if (isZero) {
      netLabel = 'Estáis a mano ✅';
      netClass = '';
      settleLabel = null;
    } else if (isPositive) {
      netLabel = `${esc(entry.person)} te debe <strong>${net.toFixed(2)} €</strong>`;
      netClass = 'income';
      settleLabel = `✅ Saldar con ${esc(entry.person)} — cobrar ${net.toFixed(2)} €`;
    } else {
      netLabel = `Le debes a ${esc(entry.person)} <strong>${Math.abs(net).toFixed(2)} €</strong>`;
      netClass = 'expense';
      settleLabel = `✅ Saldar con ${esc(entry.person)} — pagar ${Math.abs(net).toFixed(2)} €`;
    }

    const allDebts = [...entry.owedToMe, ...entry.iOwe];

    return `<div class="debt-card debt-person-card ${isZero ? '' : (isPositive ? 'debt-owed-to-me' : 'debt-i-owe')}">
      <div class="debt-group-header" onclick="Deudas._toggleNetPerson('${safePerson}')">
        <div class="debt-card-main" style="margin-bottom:0">
          <div class="debt-avatar">${esc(entry.person.charAt(0).toUpperCase())}</div>
          <div class="debt-info">
            <div class="debt-person">${esc(entry.person)}</div>
            <div class="debt-desc" style="font-size:12px;margin-top:2px">${netLabel}</div>
            <div class="debt-meta" style="margin-top:2px">
              ${entry.owedToMe.length ? `<span class="tx-adj-badge" style="background:#D1FAE5;color:#065F46">↑ me deben ${entry.owedToMe.reduce((s, d) => s + d.amount, 0).toFixed(2)}€</span>` : ''}
              ${entry.iOwe.length ? `<span class="tx-adj-badge" style="background:#FEE2E2;color:#991B1B">↓ debo ${entry.iOwe.reduce((s, d) => s + d.amount, 0).toFixed(2)}€</span>` : ''}
            </div>
          </div>
          <div class="debt-amount ${netClass}" style="min-width:60px;text-align:right">
            ${isZero ? '—' : `${isPositive ? '+' : '-'}${Math.abs(net).toFixed(2)}€`}
          </div>
          <span class="debt-chevron">${expanded ? '▾' : '▸'}</span>
        </div>
      </div>
      ${expanded ? `<div class="debt-group-members">
        ${entry.owedToMe.length ? `<div style="font-size:10px;font-weight:700;color:var(--income);padding:4px 6px;text-transform:uppercase;letter-spacing:.5px">↑ Me debe</div>` : ''}
        ${entry.owedToMe.map(d => this._renderNetDebtRow(d, true)).join('')}
        ${entry.iOwe.length ? `<div style="font-size:10px;font-weight:700;color:var(--expense);padding:4px 6px;text-transform:uppercase;letter-spacing:.5px">↓ Debo yo</div>` : ''}
        ${entry.iOwe.map(d => this._renderNetDebtRow(d, false)).join('')}
      </div>` : ''}
      ${!isZero ? `<div class="debt-actions">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settlePersonNetAction('${safePerson}')">${settleLabel}</button>
      </div>` : ''}
    </div>`;
  },

  _renderNetDebtRow(d, isOwedToMe) {
    const { dateLabel, daysAgo, urgency } = this._dateMeta(d.date);
    return `<div class="debt-member-row">
      <div class="debt-member-main">
        <div class="debt-info" style="margin-left:0">
          <div class="debt-person" style="font-size:13px">${esc(d.description || d.category || 'Sin descripción')}</div>
          <div class="debt-meta">
            <span style="${urgency}">${dateLabel}${daysAgo > 0 ? ` · hace ${daysAgo}d` : ''}</span>
            ${d.linkedTxId ? '<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">📋 mov.</span>' : ''}
          </div>
        </div>
        <div class="debt-amount debt-amount-sm ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${d.amount.toFixed(2)}€</div>
      </div>
      <div class="debt-actions debt-actions-sm">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settle('${d.id}')">✅</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._edit('${d.id}')">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._delete('${d.id}')">🗑️</button>
      </div>
    </div>`;
  },

  _settlePersonNetAction(person) {
    const net = this._scopeGetNetBalance(person);
    const isShared = this.scope === 'shared';
    if (Math.abs(net) < 0.01) {
      const pending = this._getPendingDebts().filter(d => d.person === person);
      App.showConfirm('Estáis a mano', `¿Marcar las ${pending.length} deuda(s) con ${esc(person)} como liquidadas? El saldo neto es cero, no se creará ningún movimiento.`, () => {
        this._scopeSettlePersonNet(person);
        this._refreshAll();
        App.showToast(`${person}: todas las deudas liquidadas`);
      });
      return;
    }
    const isPositive = net > 0;
    const sharedNote = isShared ? ' (espacio compartido — no afecta a tu saldo personal)' : '';
    const msg = isPositive
      ? `${esc(person)} te paga ${net.toFixed(2)} € (neto)${sharedNote}. Todas las deudas con ${esc(person)} quedarán saldadas.`
      : `Pagas ${Math.abs(net).toFixed(2)} € a ${esc(person)} (neto)${sharedNote}. Todas las deudas con ${esc(person)} quedarán saldadas.`;
    App.showConfirm(`⚖️ Saldar con ${esc(person)}`, msg, () => {
      const tx = this._scopeSettlePersonNet(person);
      this._refreshAll();
      App.showToast(tx
        ? `${person} saldado · ${isPositive ? 'cobrado' : 'pagado'} ${Math.abs(net).toFixed(2)}€`
        : `${person}: deudas liquidadas`);
    });
  },

  _refreshAll() {
    this.render();
    Dashboard.render();
    App._refreshConfigDependents?.();
    if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
    if (document.getElementById('tab-calendario')?.classList.contains('active')) Calendario.render();
  },

  splitFieldsHtml(prefix, totalAmount = '', splitCount = 2) {
    const share = totalAmount ? Store.calcSplitAmount(totalAmount, splitCount).toFixed(2) : '';
    return `
      <div class="form-group">
        <label>Total del gasto (€)</label>
        <input type="number" id="${prefix}Total" step="0.01" min="0.01" value="${totalAmount}"
          oninput="Deudas._recalcSplit('${prefix}')"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700">
      </div>
      <div class="form-group">
        <label>¿Entre cuántas personas? <span style="font-weight:400;color:var(--text-secondary)">(tú incluido)</span></label>
        <input type="number" id="${prefix}SplitCount" min="2" max="20" value="${splitCount}"
          oninput="Deudas._recalcSplit('${prefix}')"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Con 2 personas se divide a mitad. Con más, se reparte a partes iguales.</div>
      </div>
      <div class="form-group">
        <label>Importe por persona (€)</label>
        <input type="number" id="${prefix}Amount" step="0.01" min="0.01" value="${share}" placeholder="0.00"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
      </div>`;
  },

  // ── Split mode: manual (quick / lines / by-person) ───────────────────────

  _getSplitMode(prefix) {
    const m = document.getElementById(prefix + 'SplitMode')?.value || 'simple';
    return m === 'exclusions' ? 'manual' : m;
  },

  _personFieldId(prefix, person) {
    return prefix + 'Amt_' + person.replace(/[^a-zA-Z0-9]/g, '_');
  },

  _splitLineId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
  },

  _computeSplitAmounts(lines, persons, type = 'owed_to_me') {
    const count = Math.max(persons.length + 1, 2);
    const isOwed = type === 'owed_to_me';
    const result = {};
    for (const person of persons) {
      let owed = 0;
      for (const line of lines) {
        const amt = parseFloat(line.amount) || 0;
        if (amt <= 0) continue;
        if (line.mode === 'equal') {
          owed += amt / count;
        } else if (line.mode === 'custom' && line.assignments) {
          owed += parseFloat(line.assignments[person]) || 0;
        } else if (line.mode === 'sole') {
          if (isOwed && line.payer === person) owed += amt;
          else if (!isOwed && line.payer === 'me') {
            owed += persons.length === 1 ? amt : amt / persons.length;
          }
        }
      }
      result[person] = Math.round(owed * 100) / 100;
    }
    return result;
  },

  _getManualSubMode(prefix) {
    return document.getElementById(prefix + 'ManualSubMode')?.value || 'quick';
  },

  _switchManualSubMode(prefix, mode) {
    const el = document.getElementById(prefix + 'ManualSubMode');
    if (el) el.value = mode;
    const sections = { quick: 'Quick', lines: 'Lines', byperson: 'ByPerson' };
    const buttons = { quick: 'Quick', lines: 'Lines', byperson: 'Byperson' };
    for (const [m, suffix] of Object.entries(sections)) {
      const sec = document.getElementById(prefix + 'Manual' + suffix);
      if (sec) sec.style.display = m === mode ? '' : 'none';
      document.getElementById(prefix + 'ManualBtn' + buttons[m])?.classList.toggle('active', m === mode);
    }
    if (mode === 'lines') this._ensureDefaultLines(prefix);
    if (mode === 'byperson') this._renderByPersonGrid(prefix);
    this._recalcManualSplit(prefix);
  },

  _ensureDefaultLines(prefix) {
    const container = document.getElementById(prefix + 'LinesContainer');
    if (!container || container.children.length) return;
    this._addSplitLine(prefix, { mode: 'equal', amount: document.getElementById(prefix + 'ManualTotal')?.value || '' });
  },

  _linesFromDom(prefix) {
    const container = document.getElementById(prefix + 'LinesContainer');
    if (!container) return [];
    const persons = this._getSelectedPeople(prefix);
    const lines = [];
    container.querySelectorAll('.split-line-row').forEach(row => {
      const amount = parseFloat(row.querySelector('.split-line-amt')?.value) || 0;
      const mode = row.querySelector('.split-line-mode')?.value || 'equal';
      const payer = row.querySelector('.split-line-payer')?.value || '';
      const id = row.dataset.lineId || this._splitLineId();
      const line = { id, amount, mode: mode === 'sole_me' ? 'sole' : mode, payer: mode === 'sole_me' ? 'me' : payer, label: '' };
      if (mode === 'custom') {
        line.mode = 'custom';
        line.assignments = {};
        row.querySelectorAll('.split-line-custom-amt').forEach(inp => {
          const p = inp.dataset.person;
          if (p) line.assignments[p] = parseFloat(inp.value) || 0;
        });
        line.amount = Object.values(line.assignments).reduce((s, a) => s + a, 0);
      }
      if (amount > 0 || mode === 'custom') lines.push(line);
    });
    return lines;
  },

  _splitLineRowHtml(prefix, line, persons, type) {
    const id = line.id || this._splitLineId();
    const mode = line.mode === 'sole' && line.payer === 'me' ? 'sole_me' : (line.mode || 'equal');
    const isOwed = type === 'owed_to_me';
    const payerOpts = persons.map(p =>
      `<option value="${esc(p)}"${line.payer === p ? ' selected' : ''}>Solo ${esc(p)}</option>`
    ).join('');
    const customBlock = mode === 'custom' && persons.length ? `
      <div class="split-line-custom-grid">
        ${persons.map(p => `
          <label class="split-custom-cell">
            <span>${esc(p)}</span>
            <input type="number" class="split-line-custom-amt" data-person="${esc(p)}" step="0.01" min="0"
              value="${line.assignments?.[p] > 0 ? line.assignments[p] : ''}" placeholder="0"
              oninput="Deudas._recalcManualSplit('${prefix}')">
          </label>`).join('')}
      </div>` : '';
    return `
      <div class="split-line-row" data-line-id="${id}">
        <div class="split-line-main">
          <input type="number" class="split-line-amt" step="0.01" min="0"
            value="${line.amount > 0 ? line.amount : ''}" placeholder="€"
            oninput="Deudas._recalcManualSplit('${prefix}')">
          <select class="split-line-mode" onchange="Deudas._onSplitLineModeChange('${prefix}','${id}')">
            <option value="equal"${mode === 'equal' ? ' selected' : ''}>A medias (todos)</option>
            <option value="sole_me"${mode === 'sole_me' ? ' selected' : ''}>Solo yo</option>
            ${persons.length ? `<option value="sole"${mode === 'sole' && line.payer !== 'me' ? ' selected' : ''}>Solo una persona</option>` : ''}
            ${persons.length > 1 ? `<option value="custom"${mode === 'custom' ? ' selected' : ''}>Cada uno su parte</option>` : ''}
          </select>
          <select class="split-line-payer" style="${mode === 'sole' ? '' : 'display:none'}"
            onchange="Deudas._recalcManualSplit('${prefix}')">
            ${payerOpts || '<option value="">—</option>'}
          </select>
          <button type="button" class="split-line-remove" onclick="Deudas._removeSplitLine('${prefix}','${id}')" title="Quitar">✕</button>
        </div>
        ${customBlock}
        <div class="split-line-hint">${mode === 'equal' ? (isOwed ? 'Se divide entre tú y las personas seleccionadas' : 'Tu parte de este importe') : mode === 'sole_me' ? (isOwed ? 'Lo pagas tú, no entra en el reparto' : 'Solo tú lo consumes') : mode === 'custom' ? 'Indica cuánto debe cada persona de esta partida' : 'Esa persona debe/consumió todo este importe'}</div>
      </div>`;
  },

  _onSplitLineModeChange(prefix, lineId) {
    const container = document.getElementById(prefix + 'LinesContainer');
    const row = container?.querySelector(`[data-line-id="${lineId}"]`);
    if (!row) return;
    const mode = row.querySelector('.split-line-mode')?.value;
    const payerSel = row.querySelector('.split-line-payer');
    if (payerSel) payerSel.style.display = mode === 'sole' ? '' : 'none';
    const persons = this._getSelectedPeople(prefix);
    const type = document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    const amount = parseFloat(row.querySelector('.split-line-amt')?.value) || 0;
    const line = { id: lineId, amount, mode: mode === 'sole_me' ? 'sole' : mode, payer: mode === 'sole_me' ? 'me' : (row.querySelector('.split-line-payer')?.value || persons[0] || '') };
    if (mode === 'custom' && line.assignments) line.assignments = line.assignments;
    row.outerHTML = this._splitLineRowHtml(prefix, line, persons, type);
    this._recalcManualSplit(prefix);
  },

  _addSplitLine(prefix, init = {}) {
    const container = document.getElementById(prefix + 'LinesContainer');
    if (!container) return;
    const persons = this._getSelectedPeople(prefix);
    const type = document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    const line = { id: this._splitLineId(), mode: init.mode || 'equal', amount: init.amount || '', payer: init.payer || persons[0] || '' };
    container.insertAdjacentHTML('beforeend', this._splitLineRowHtml(prefix, line, persons, type));
    this._recalcManualSplit(prefix);
  },

  _removeSplitLine(prefix, lineId) {
    document.getElementById(prefix + 'LinesContainer')?.querySelector(`[data-line-id="${lineId}"]`)?.remove();
    this._recalcManualSplit(prefix);
  },

  _applyManualPreset(prefix, preset) {
    const totalEl = document.getElementById(prefix + 'ManualTotal');
    const total = parseFloat(totalEl?.value) || 0;
    const soloYoEl = document.getElementById(prefix + 'SoloYo');
    const soloPerEl = document.getElementById(prefix + 'SoloPersona');
    const container = document.getElementById(prefix + 'LinesContainer');

    if (preset === 'all_equal') {
      this._switchManualSubMode(prefix, 'lines');
      if (container) {
        container.innerHTML = '';
        if (total > 0) this._addSplitLine(prefix, { mode: 'equal', amount: total });
      }
      if (soloYoEl) soloYoEl.value = '';
      if (soloPerEl) soloPerEl.value = '';
    } else if (preset === 'my_part_rest') {
      this._switchManualSubMode(prefix, 'quick');
      soloYoEl?.focus();
    } else if (preset === 'half_half') {
      this._switchManualSubMode(prefix, 'quick');
      if (soloYoEl) soloYoEl.value = '';
      if (soloPerEl) soloPerEl.value = '';
    }
    this._recalcManualSplit(prefix);
  },

  _renderByPersonGrid(prefix) {
    const grid = document.getElementById(prefix + 'ByPersonGrid');
    if (!grid) return;
    const persons = this._getSelectedPeople(prefix);
    const type = document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    const isOwed = type === 'owed_to_me';
    if (!persons.length) {
      grid.innerHTML = '<div class="split-empty-hint">Selecciona al menos una persona abajo para asignar importes.</div>';
      return;
    }
    grid.innerHTML = persons.map(p => `
      <div class="split-byperson-row">
        <span class="split-byperson-name">${esc(p)}</span>
        <div class="split-byperson-input-wrap">
          <input type="number" id="${this._personFieldId(prefix, p)}" class="split-byperson-amt" step="0.01" min="0"
            placeholder="0.00" oninput="Deudas._recalcManualSplit('${prefix}')">
          <span class="split-byperson-suffix">€</span>
        </div>
        <span class="split-byperson-label">${isOwed ? 'te debe' : 'le debes'}</span>
      </div>`).join('');
  },

  _recalcManualSplit(prefix) {
    const subMode = this._getManualSubMode(prefix);
    const total = parseFloat(document.getElementById(prefix + 'ManualTotal')?.value) || parseFloat(document.getElementById(prefix + 'ExclTotal')?.value) || 0;
    const persons = this._getSelectedPeople(prefix);
    const type = document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    const isOwed = type === 'owed_to_me';
    const N = Math.max(persons.length + 1, 2);
    const summaryEl = document.getElementById(prefix + 'ManualSummary');
    if (!summaryEl) return;

    let amountsByPerson = {};
    let linesSum = 0;
    let lines = [];

    if (subMode === 'byperson') {
      for (const p of persons) {
        const v = parseFloat(document.getElementById(this._personFieldId(prefix, p))?.value) || 0;
        if (v > 0) amountsByPerson[p] = Math.round(v * 100) / 100;
      }
      linesSum = Object.values(amountsByPerson).reduce((s, a) => s + a, 0);
    } else if (subMode === 'lines') {
      lines = this._linesFromDom(prefix);
      linesSum = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      amountsByPerson = this._computeSplitAmounts(lines, persons, type);
    } else {
      const soloYo = parseFloat(document.getElementById(prefix + 'SoloYo')?.value) || 0;
      const soloPer = parseFloat(document.getElementById(prefix + 'SoloPersona')?.value) || 0;
      const shared = Math.max(0, total - soloYo - soloPer);
      lines = [];
      if (shared > 0) lines.push({ mode: 'equal', amount: shared, payer: '' });
      if (soloYo > 0) lines.push({ mode: 'sole', amount: soloYo, payer: 'me' });
      if (soloPer > 0 && persons[0]) lines.push({ mode: 'sole', amount: soloPer, payer: persons[0] });
      linesSum = total;
      amountsByPerson = this._computeSplitAmounts(lines, persons, type);

      const quickHint = document.getElementById(prefix + 'QuickHint');
      if (quickHint && total > 0) {
        const sharedShare = shared / N;
        quickHint.innerHTML = shared > 0
          ? `Resto compartido: <strong>${shared.toFixed(2)} €</strong> → ${sharedShare.toFixed(2)} € por persona (${N} personas)`
          : (soloYo > 0 || soloPer > 0 ? 'Todo asignado a partes personales' : 'Introduce las partes o deja todo a medias');
      }
    }

    const sumMismatch = subMode === 'lines' && total > 0 && Math.abs(linesSum - total) > 0.02;
    const personRows = persons.map(p => {
      const amt = amountsByPerson[p] || 0;
      return `<div class="split-preview-row">
        <span>${esc(p)}</span>
        <strong class="${isOwed ? 'income' : 'expense'}">${isOwed ? '+' : '-'}${amt.toFixed(2)} €</strong>
      </div>`;
    }).join('');

    const myShare = subMode === 'quick' && total > 0
      ? Math.round((total - (Object.values(amountsByPerson).reduce((s, a) => s + a, 0))) * 100) / 100
      : null;

    summaryEl.innerHTML = total <= 0 && !persons.length ? '' : `
      <div class="manual-split-summary${sumMismatch ? ' has-error' : ''}">
        ${subMode === 'lines' ? `
          <div class="split-sum-bar">
            <span>Suma partidas</span>
            <span><strong>${linesSum.toFixed(2)} €</strong> / ${total.toFixed(2)} €</span>
          </div>
          ${sumMismatch ? '<div class="split-error">⚠️ La suma de partidas no coincide con el total</div>' : ''}` : ''}
        ${subMode === 'byperson' && total > 0 ? `
          <div class="split-sum-bar">
            <span>Total asignado</span>
            <span><strong>${linesSum.toFixed(2)} €</strong> / ${total.toFixed(2)} €</span>
          </div>` : ''}
        ${persons.length ? `
          <div class="split-preview-title">Resumen por persona</div>
          <div class="split-preview-grid">${personRows || '<div class="split-empty-hint">Sin importes aún</div>'}</div>
          ${myShare != null && subMode === 'quick' ? `<div class="split-preview-me">Tu parte del gasto: <strong>${myShare.toFixed(2)} €</strong></div>` : ''}
        ` : '<div class="split-empty-hint">Selecciona persona(s) para ver el reparto</div>'}
      </div>`;

    if (subMode === 'lines') {
      const sumEl = document.getElementById(prefix + 'LinesSum');
      if (sumEl) sumEl.textContent = linesSum.toFixed(2);
      const totEl = document.getElementById(prefix + 'LinesTotal');
      if (totEl) totEl.textContent = total.toFixed(2);
    }
  },

  _updateExclusionsPersonLabel(prefix, persons) {
    const card = document.getElementById(prefix + 'SoloPersonaCard');
    const label = document.getElementById(prefix + 'SoloPersonaLabel');
    if (!card) return;
    if (persons.length > 0) {
      card.style.display = '';
      if (label) label.textContent = persons[0];
      document.querySelectorAll(`#${prefix}LinesContainer .split-line-payer`).forEach(sel => {
        const cur = sel.value;
        sel.innerHTML = persons.map(p => `<option value="${esc(p)}"${p === cur ? ' selected' : ''}>${esc(p)}</option>`).join('');
      });
    } else {
      card.style.display = 'none';
    }
    this._renderByPersonGrid(prefix);
    this._recalcManualSplit(prefix);
  },

  _manualSplitHtml(prefix, total, soloYo, soloPersona, initLines, type) {
    const isOwed = (type || 'owed_to_me') === 'owed_to_me';
    const personName = '';
    const lines = initLines && initLines.length ? initLines : [];
    const hasCustomLines = lines.some(l => l.mode === 'custom') || lines.length > 2;
    const subMode = hasCustomLines ? 'lines' : 'quick';

    const linesHtml = lines.length
      ? lines.map(l => this._splitLineRowHtml(prefix, l, [], type)).join('')
      : '';

    return `
      <div class="manual-split">
        <div class="form-group">
          <label>Total del gasto (€)</label>
          <input type="number" id="${prefix}ManualTotal" step="0.01" min="0.01"
            value="${total > 0 ? total : ''}" placeholder="0.00"
            oninput="Deudas._recalcManualSplit('${prefix}')"
            style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700;background:var(--card);color:var(--text)">
        </div>

        <div class="manual-preset-chips">
          <button type="button" class="preset-chip" onclick="Deudas._applyManualPreset('${prefix}','my_part_rest')">⚡ Mi parte + resto a medias</button>
          <button type="button" class="preset-chip" onclick="Deudas._applyManualPreset('${prefix}','all_equal')">➗ Todo a medias</button>
        </div>

        <input type="hidden" id="${prefix}ManualSubMode" value="${subMode}">
        <div class="manual-sub-toggle">
          <button type="button" class="cal-type-btn${subMode === 'quick' ? ' active' : ''}" id="${prefix}ManualBtnQuick"
            onclick="Deudas._switchManualSubMode('${prefix}','quick')">⚡ Rápido</button>
          <button type="button" class="cal-type-btn${subMode === 'lines' ? ' active' : ''}" id="${prefix}ManualBtnLines"
            onclick="Deudas._switchManualSubMode('${prefix}','lines')">📝 Partidas</button>
          <button type="button" class="cal-type-btn${subMode === 'byperson' ? ' active' : ''}" id="${prefix}ManualBtnByperson"
            onclick="Deudas._switchManualSubMode('${prefix}','byperson')">👥 Por persona</button>
        </div>

        <div id="${prefix}ManualQuick" style="${subMode === 'quick' ? '' : 'display:none'}">
          <div class="excl-grid">
            <div class="excl-card excl-yo">
              <div class="excl-card-label">Solo yo</div>
              <div class="excl-card-hint">${isOwed ? 'Lo consumo/pago solo yo — no se reparte' : 'Mi parte personal'}</div>
              <input type="number" id="${prefix}SoloYo" class="excl-input" step="0.01" min="0"
                value="${soloYo > 0 ? soloYo : ''}" placeholder="ej: 20"
                oninput="Deudas._recalcManualSplit('${prefix}')">
            </div>
            <div class="excl-card excl-otro" id="${prefix}SoloPersonaCard" style="display:none">
              <div class="excl-card-label">Solo <span id="${prefix}SoloPersonaLabel">${esc(personName)}</span></div>
              <div class="excl-card-hint">${isOwed ? 'Esa persona lo consume entero → te lo debe' : 'Esa persona lo paga sola'}</div>
              <input type="number" id="${prefix}SoloPersona" class="excl-input" step="0.01" min="0"
                value="${soloPersona > 0 ? soloPersona : ''}" placeholder="0.00"
                oninput="Deudas._recalcManualSplit('${prefix}')">
            </div>
            <div class="excl-card excl-shared">
              <div class="excl-card-label">Resto a medias</div>
              <div class="excl-card-hint">Total − solo yo − solo otra persona</div>
              <div id="${prefix}QuickHint" class="excl-quick-result">—</div>
            </div>
          </div>
        </div>

        <div id="${prefix}ManualLines" style="${subMode === 'lines' ? '' : 'display:none'}">
          <div class="split-lines-header">
            <span>Añade partidas que sumen el total</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Deudas._addSplitLine('${prefix}')">+ Partida</button>
          </div>
          <div id="${prefix}LinesContainer" class="split-lines-container">${linesHtml}</div>
          <div class="split-sum-bar subtle">
            <span>Suma</span>
            <span><strong id="${prefix}LinesSum">0.00</strong> / <span id="${prefix}LinesTotal">${total > 0 ? total.toFixed(2) : '0.00'}</span> €</span>
          </div>
        </div>

        <div id="${prefix}ManualByPerson" style="${subMode === 'byperson' ? '' : 'display:none'}">
          <div class="split-byperson-hint">Indica cuánto debe cada persona del total del gasto.</div>
          <div id="${prefix}ByPersonGrid" class="split-byperson-grid"></div>
        </div>

        <div id="${prefix}ManualSummary"></div>
      </div>`;
  },

  _splitModeHtml(prefix, totalStr, splitCount, splitMode, initLines, type) {
    const isManual = splitMode === 'exclusions' || splitMode === 'manual';
    let soloYo = 0, soloPersona = 0, exclTotal = parseFloat(totalStr) || 0;
    if (initLines && initLines.length) {
      soloYo = initLines.filter(l => l.mode === 'sole' && l.payer === 'me').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      soloPersona = initLines.filter(l => l.mode === 'sole' && l.payer && l.payer !== 'me').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      exclTotal = initLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) || exclTotal;
    }
    const modeVal = isManual ? 'manual' : 'simple';

    return `
      <input type="hidden" id="${prefix}SplitMode" value="${modeVal}">
      <div class="split-mode-toggle">
        <button type="button" class="cal-type-btn${!isManual ? ' active' : ''}" id="${prefix}ModeBtnSimple"
          onclick="Deudas._switchSplitMode('${prefix}','simple')">A partes iguales</button>
        <button type="button" class="cal-type-btn${isManual ? ' active' : ''}" id="${prefix}ModeBtnExcl"
          onclick="Deudas._switchSplitMode('${prefix}','manual')">Dividir manualmente</button>
      </div>
      <div id="${prefix}SimpleSplitSection" style="${isManual ? 'display:none' : ''}">
        ${this.splitFieldsHtml(prefix, totalStr, splitCount)}
      </div>
      <div id="${prefix}ExclusionsSplitSection" style="${isManual ? '' : 'display:none'}">
        ${this._manualSplitHtml(prefix, exclTotal, soloYo, soloPersona, initLines, type || 'owed_to_me')}
      </div>`;
  },

  _switchSplitMode(prefix, mode) {
    const normalized = mode === 'exclusions' ? 'manual' : mode;
    const modeEl = document.getElementById(prefix + 'SplitMode');
    if (modeEl) modeEl.value = normalized;

    const simpleSection = document.getElementById(prefix + 'SimpleSplitSection');
    const exclSection   = document.getElementById(prefix + 'ExclusionsSplitSection');
    const btnSimple     = document.getElementById(prefix + 'ModeBtnSimple');
    const btnExcl       = document.getElementById(prefix + 'ModeBtnExcl');

    if (simpleSection) simpleSection.style.display = normalized === 'manual' ? 'none' : '';
    if (exclSection)   exclSection.style.display   = normalized === 'manual' ? '' : 'none';
    if (btnSimple) btnSimple.classList.toggle('active', normalized !== 'manual');
    if (btnExcl)   btnExcl.classList.toggle('active', normalized === 'manual');

    if (normalized === 'manual') {
      const simpleTotalEl = document.getElementById(prefix + 'Total');
      const manualTotalEl = document.getElementById(prefix + 'ManualTotal');
      if (simpleTotalEl?.value && manualTotalEl && !manualTotalEl.value) {
        manualTotalEl.value = simpleTotalEl.value;
      }
      this._updateExclusionsPersonLabel(prefix, this._getSelectedPeople(prefix));
      if (this._getManualSubMode(prefix) === 'lines') this._ensureDefaultLines(prefix);
      this._recalcManualSplit(prefix);
    } else {
      const manualTotalEl = document.getElementById(prefix + 'ManualTotal');
      const simpleTotalEl = document.getElementById(prefix + 'Total');
      if (manualTotalEl?.value && simpleTotalEl) {
        simpleTotalEl.value = manualTotalEl.value;
        this._recalcSplit(prefix);
      }
    }
  },

  _readDebtFormFromManual(prefix, persons) {
    const subMode = this._getManualSubMode(prefix);
    const total = parseFloat(document.getElementById(prefix + 'ManualTotal')?.value) || 0;
    const type = document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    const N = Math.max(persons.length + 1, 2);
    let splitLines = [];
    let amountsByPerson = {};

    if (subMode === 'byperson') {
      for (const p of persons) {
        const v = parseFloat(document.getElementById(this._personFieldId(prefix, p))?.value) || 0;
        if (v > 0) amountsByPerson[p] = Math.round(v * 100) / 100;
      }
      splitLines = Object.entries(amountsByPerson).map(([p, a]) => ({
        id: this._splitLineId(), label: p, amount: a, mode: 'custom', assignments: { [p]: a },
      }));
    } else if (subMode === 'lines') {
      splitLines = this._linesFromDom(prefix).map(l => ({
        ...l,
        amount: Math.round((parseFloat(l.amount) || 0) * 100) / 100,
        label: l.label || (l.mode === 'equal' ? 'A medias' : l.mode === 'sole' && l.payer === 'me' ? 'Solo yo' : `Solo ${l.payer}`),
      }));
      amountsByPerson = this._computeSplitAmounts(splitLines, persons, type);
    } else {
      const soloYo = parseFloat(document.getElementById(prefix + 'SoloYo')?.value) || 0;
      const soloPer = parseFloat(document.getElementById(prefix + 'SoloPersona')?.value) || 0;
      const shared = Math.max(0, total - soloYo - soloPer);
      if (shared > 0) splitLines.push({ id: this._splitLineId(), label: 'A medias', amount: Math.round(shared * 100) / 100, mode: 'equal', payer: '' });
      if (soloYo > 0) splitLines.push({ id: this._splitLineId(), label: 'Solo yo', amount: Math.round(soloYo * 100) / 100, mode: 'sole', payer: 'me' });
      if (soloPer > 0 && persons[0]) splitLines.push({ id: this._splitLineId(), label: `Solo ${persons[0]}`, amount: Math.round(soloPer * 100) / 100, mode: 'sole', payer: persons[0] });
      amountsByPerson = this._computeSplitAmounts(splitLines, persons, type);
    }

    const totalOwed = Object.values(amountsByPerson).reduce((s, a) => s + a, 0);
    if (totalOwed <= 0 && persons.length) {
      App.showToast('Indica al menos un importe en el reparto', 4000);
      return null;
    }
    if (subMode === 'lines' && total > 0) {
      const linesSum = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
      if (Math.abs(linesSum - total) > 0.02) {
        App.showToast('⚠️ La suma de partidas debe coincidir con el total', 4000);
        return null;
      }
    }

    return {
      persons,
      person: persons[0] || '',
      amount: persons.length === 1 ? (amountsByPerson[persons[0]] || 0) : totalOwed,
      totalAmount: total || null,
      splitCount: N,
      amountsByPerson,
      splitLines: splitLines.length ? splitLines : null,
    };
  },

  // Legacy alias
  _recalcExclusions(prefix) { this._recalcManualSplit(prefix); },
  _readDebtFormFromExclusions(prefix, persons) { return this._readDebtFormFromManual(prefix, persons); },

  personPickerHtml(prefix, selected = []) {
    const people = Store.getPeople();
    const groups = Store.getPeopleGroups();
    const sel = new Set(selected);
    return `
      <div class="form-group">
        <label>Persona(s)</label>
        <input type="text" id="${prefix}Person" placeholder="Escribe nombres (Ana, Luis…) y pulsa Enter"
          onkeydown="if(event.key==='Enter'){event.preventDefault();Deudas._addPersonFromInput('${prefix}')}"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px">
        <input type="hidden" id="${prefix}SelectedPeople" value="${selected.join('|')}">
        ${people.length ? `<div class="person-chips" id="${prefix}PeopleChips">
          ${people.map(p => `<button type="button" class="person-chip${sel.has(p) ? ' active' : ''}" data-person="${esc(p)}" onclick="Deudas._pickPerson('${prefix}','${p.replace(/'/g, "\\'")}')">${esc(p)}</button>`).join('')}
        </div>` : '<div style="font-size:11px;color:var(--text-secondary)">Las personas que uses se guardarán aquí.</div>'}
        ${groups.length ? `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--text-secondary)">Grupos</div>
          <div class="person-chips">${groups.map(g => `<button type="button" class="person-chip group" onclick="Deudas._pickGroup('${prefix}','${g.id}')">👥 ${esc(g.name)} (${g.members.length})</button>`).join('')}</div>` : ''}
        <div id="${prefix}SelectedList" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;min-height:14px">${selected.length ? selected.map(p => `<span class="person-chip active">${esc(p)}</span>`).join('') : ''}</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Selecciona varias personas o escribe varios nombres separados por comas. Se creará una deuda por persona.</div>
      </div>`;
  },

  _recalcSplit(prefix) {
    const total = parseFloat(document.getElementById(prefix + 'Total')?.value);
    const count = parseInt(document.getElementById(prefix + 'SplitCount')?.value, 10) || 2;
    const amtEl = document.getElementById(prefix + 'Amount');
    if (!amtEl || !total || total <= 0) return;
    amtEl.value = Store.calcSplitAmount(total, count).toFixed(2);
  },

  _parsePersonNames(text) {
    if (!text) return [];
    return [...new Set(text.split(/[,;]|\s+y\s+/i).map(s => s.trim()).filter(Boolean))];
  },

  _getSelectedPeople(prefix) {
    const raw = document.getElementById(prefix + 'SelectedPeople')?.value || '';
    if (!raw) return [];
    return raw.split('|').map(s => s.trim()).filter(Boolean);
  },

  _setSelectedPeople(prefix, people) {
    const unique = [...new Set(people.filter(Boolean))];
    const hidden = document.getElementById(prefix + 'SelectedPeople');
    if (hidden) hidden.value = unique.join('|');
    const list = document.getElementById(prefix + 'SelectedList');
    if (list) {
      list.innerHTML = unique.length
        ? unique.map(p => `<span class="person-chip active" style="margin:2px">${esc(p)} <button type="button" style="border:none;background:none;cursor:pointer;font-size:10px" onclick="Deudas._removePerson('${prefix}','${p.replace(/'/g, "\\'")}')">✕</button></span>`).join('')
        : '';
    }
    document.querySelectorAll(`#${prefix}PeopleChips .person-chip:not(.group)`).forEach(btn => {
      const name = btn.dataset.person || btn.textContent.trim();
      btn.classList.toggle('active', unique.includes(name));
    });
    const personInput = document.getElementById(prefix + 'Person');
    if (personInput) personInput.value = '';
  },

  _removePerson(prefix, name) {
    this._setSelectedPeople(prefix, this._getSelectedPeople(prefix).filter(p => p !== name));
    this._syncSplitCount(prefix);
  },

  _addPersonFromInput(prefix) {
    const input = document.getElementById(prefix + 'Person');
    if (!input) return;
    const names = this._parsePersonNames(input.value);
    if (!names.length) return;
    const merged = [...this._getSelectedPeople(prefix), ...names];
    this._setSelectedPeople(prefix, merged);
    names.forEach(n => Store.rememberPerson(n, false));
    this._syncSplitCount(prefix);
  },

  _syncSplitCount(prefix) {
    const selected = this._getSelectedPeople(prefix);
    const mode = this._getSplitMode(prefix);
    if (mode === 'manual') {
      this._updateExclusionsPersonLabel(prefix, selected);
      return;
    }
    const splitEl = document.getElementById(prefix + 'SplitCount');
    if (splitEl && selected.length > 0) {
      splitEl.value = Math.max(2, selected.length + 1);
      this._recalcSplit(prefix);
    }
  },

  _pickPerson(prefix, name) {
    const current = this._getSelectedPeople(prefix);
    const idx = current.indexOf(name);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(name);
    this._setSelectedPeople(prefix, current);
    this._syncSplitCount(prefix);
  },

  _pickGroup(prefix, groupId) {
    const g = Store.getPeopleGroups().find(x => x.id === groupId);
    if (!g) return;
    this._setSelectedPeople(prefix, g.members);
    this._syncSplitCount(prefix);
  },

  _readDebtForm(prefix) {
    this._addPersonFromInput(prefix);
    const selected = this._getSelectedPeople(prefix);
    const persons = [...new Set(selected)];

    if (this._getSplitMode(prefix) === 'manual') {
      return this._readDebtFormFromManual(prefix, persons);
    }

    const totalAmount = parseFloat(document.getElementById(prefix + 'Total')?.value) || null;
    const splitCount = Math.max(persons.length + 1, parseInt(document.getElementById(prefix + 'SplitCount')?.value, 10) || 2);
    let amount = parseFloat(document.getElementById(prefix + 'Amount')?.value);
    if ((!amount || amount <= 0) && totalAmount) amount = Store.calcSplitAmount(totalAmount, splitCount);
    return { persons, person: persons[0] || '', amount, totalAmount, splitCount };
  },

  debtFormHtml(prefix, opts = {}) {
    const {
      type = 'owed_to_me',
      totalAmount = '',
      splitCount = 2,
      selectedPeople = [],
      description = '',
      category = '',
      date = new Date().toISOString().split('T')[0],
      linkedTxId = '',
      showLink = true,
      showTxBanner = null,
      splitMode = 'simple',
      splitLines = null,
    } = opts;
    const categories = Store.getCategories();
    const isOwed = type === 'owed_to_me';
    const catOptions = categories.map(c =>
      `<option value="${esc(c)}"${c === category ? ' selected' : ''}>${esc(c)}</option>`
    ).join('');
    const txs = Store.getTransactions().filter(t => Store.isExpense(t)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    const txOptions = txs.map(t =>
      `<option value="${t.id}"${t.id === linkedTxId ? ' selected' : ''}>${t.date.split('-').reverse().join('/')} · ${esc(t.description || t.category)} · ${t.amount.toFixed(2)}€</option>`
    ).join('');
    const txBanner = showTxBanner ? `
      <div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px">
        <strong>${showTxBanner.date}</strong> · ${esc(showTxBanner.description)} · <strong>${showTxBanner.amount}</strong>
        ${showTxBanner.debtCount ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${showTxBanner.debtCount} deuda(s) vinculada(s)</div>` : ''}
      </div>` : '';
    const totalStr = totalAmount !== '' && totalAmount != null ? String(totalAmount) : '';

    return `
      ${txBanner}
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <button type="button" class="cal-type-btn${isOwed ? ' active' : ''}" id="${prefix}TypeOwed" onclick="Deudas._switchDebtType('owed_to_me','${prefix}')">🟢 Me deben</button>
        <button type="button" class="cal-type-btn${!isOwed ? ' active' : ''}" id="${prefix}TypeIOwe" onclick="Deudas._switchDebtType('i_owe','${prefix}')">🔴 Debo yo</button>
      </div>
      <input type="hidden" id="${prefix}Type" value="${type}">
      <div id="${prefix}TypeHint" class="debt-type-hint ${isOwed ? 'owed-hint' : 'iowe-hint'}">
        ${isOwed
          ? (prefix === 'link'
            ? 'Pagaste tú este gasto. Registra quién te debe su parte.'
            : 'Pagaste tú el gasto entero. Se creará el movimiento automáticamente. Cuando te lo devuelvan, márcalo como cobrado.')
          : (prefix === 'link'
            ? 'Alguien pagó por ti. El gasto queda pendiente hasta que lo pagues.'
            : 'Alguien pagó por ti. Se creará un movimiento pendiente que no afectará al saldo hasta que lo pagues.')}
      </div>
      ${this._splitModeHtml(prefix, totalStr, splitCount, splitMode, splitLines, type)}
      ${this.personPickerHtml(prefix, selectedPeople)}
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" id="${prefix}Desc" value="${esc(description)}" placeholder="Ej: Cena, gasolina..." maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group">
        <label>Categoría</label>
        <select id="${prefix}Category" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          ${catOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" id="${prefix}Date" value="${date}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      ${showLink ? `
      <div class="form-group" id="${prefix}LinkGroup" style="${isOwed ? '' : 'display:none'}">
        <label>Vincular a movimiento existente (opcional)</label>
        <select id="${prefix}LinkTx" onchange="Deudas._onLinkTxChange('${prefix}')" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          <option value="">— Sin vincular —</option>
          ${txOptions}
        </select>
      </div>` : ''}`;
  },

  _readDebtFormMeta(prefix) {
    return {
      description: document.getElementById(prefix + 'Desc')?.value.trim(),
      category: document.getElementById(prefix + 'Category')?.value,
      date: document.getElementById(prefix + 'Date')?.value,
      type: document.getElementById(prefix + 'Type')?.value || 'owed_to_me',
      linkedTxId: document.getElementById(prefix + 'LinkTx')?.value || null,
    };
  },

  _getRelatedDebts(d) {
    if (!d || d.isPaid) return d ? [d] : [];
    if (d.splitGroupId) {
      const group = Store.getDebts().filter(x => x.splitGroupId === d.splitGroupId && !x.isPaid);
      if (group.length > 1) return group;
    }
    if (d.linkedTxId) {
      const linked = Store.getDebtsByLinkedTx(d.linkedTxId);
      if (linked.length) return linked;
    }
    return [d];
  },

  _replaceDebts(related, prefix, extra) {
    related.forEach(r => Store.deleteDebt(r.id));
    return this._saveDebtsFromForm(prefix, {
      ...extra,
      linkedTxId: extra.linkedTxId || null,
      skipAutoTx: !!extra.linkedTxId,
    });
  },

  _saveDebtsFromForm(prefix, extra = {}) {
    const formData = this._readDebtForm(prefix);
    if (!formData || formData === null) return null;
    const { persons, amount, totalAmount, splitCount, amountsByPerson, splitLines } = formData;
    if (persons.length === 0) { App.showToast('Indica al menos una persona'); return null; }
    if (!amountsByPerson && (!amount || amount <= 0)) { App.showToast('Importe inválido'); return null; }
    const type = extra.type || document.getElementById(prefix + 'Type')?.value || 'owed_to_me';
    let created;

    if (this.scope === 'shared') {
      // Shared debts: simple per-person entries, no balance transactions
      const perPerson = amountsByPerson
        ? Object.entries(amountsByPerson).map(([p, a]) => ({ person: p, amount: a }))
        : persons.map(p => ({ person: p, amount: amount }));
      created = perPerson.map(({ person, amount: amt }) =>
        Store.addSharedDebt({ person, amount: amt, type, description: extra.description || '', category: extra.category || 'Otros', date: extra.date })
      );
      persons.forEach(p => Store.rememberPerson(p, false));
    } else {
      const payload = {
        ...extra, totalAmount, splitCount, amount, amountsByPerson, splitLines, type,
      };
      if (extra.linkedTxId) {
        const existing = Store.getDebtsByLinkedTx(extra.linkedTxId);
        existing.forEach(d => Store.deleteDebt(d.id));
        created = Store.addDebtsForPeople({ persons, ...payload, linkedTxId: extra.linkedTxId, skipAutoTx: true });
      } else {
        created = Store.addDebtsForPeople({ persons, ...payload, skipAutoTx: extra.skipAutoTx });
      }
      persons.forEach(p => Store.rememberPerson(p, false));
      Store._save();
    }
    if (!created || created.length === 0) { App.showToast('Sin importes: comprueba el desglose'); return null; }
    return created;
  },

  render() {
    const el = document.getElementById('tab-deudas');
    if (!el) return;

    // ── Scope: if shared selected but not configured, show notice ────────────
    const isShared = this.scope === 'shared';
    if (isShared && !Store.isSharedEnabled()) {
      el.innerHTML = `
        <div class="card" style="margin-bottom:10px">
          <div class="card-header">
            <span class="card-title">💸 Deudas</span>
          </div>
          <div class="debt-view-toggle" style="margin-bottom:12px">
            <button type="button" class="cal-type-btn" onclick="Deudas._setScope('personal')">👤 Mis deudas</button>
            <button type="button" class="cal-type-btn active" onclick="Deudas._setScope('shared')">🤝 Compartidas</button>
          </div>
          <div class="empty-state" style="padding:24px 16px;text-align:center">
            <div style="font-size:32px;margin-bottom:10px">🔒</div>
            <div style="font-weight:700;margin-bottom:6px">Espacio compartido no configurado</div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:14px">
              Ve a <strong>⚙️ Ajustes → Espacio compartido</strong> e introduce el ID de fila y la frase compartida con tu pareja.
            </div>
            <button class="btn btn-primary btn-sm" onclick="App._switchTab('categorias')">Ir a Ajustes</button>
          </div>
        </div>`;
      return;
    }

    const pending   = this._getPendingDebts();
    const owedToMe  = pending.filter(d => (d.type || 'owed_to_me') === 'owed_to_me');
    const iOwe      = pending.filter(d => d.type === 'i_owe');
    const settled   = this._getSettledDebts().sort((a, b) => b.paidDate?.localeCompare(a.paidDate || '') || 0);

    const totalOwedToMe = owedToMe.reduce((s, d) => s + d.amount, 0);
    const totalIOwe     = iOwe.reduce((s, d) => s + d.amount, 0);
    const netTotal      = Math.round((totalOwedToMe - totalIOwe) * 100) / 100;
    const groupsOwed    = this._buildDebtGroups(owedToMe);
    const groupsIOwe    = this._buildDebtGroups(iOwe);
    const peopleOwed    = this._aggregateByPerson(owedToMe);
    const peopleIOwe    = this._aggregateByPerson(iOwe);
    const netBalances   = this._buildNetBalances();

    const isNet = this.viewMode.main === 'net';
    const scopeLabel = isShared
      ? `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;background:#E0E7FF;color:#4F46E5;margin-left:6px">Compartidas 🔒</span>`
      : '';

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">💸 Deudas${scopeLabel}</span>
          <button class="btn btn-primary btn-sm" onclick="Deudas._openNew()">+ Nueva deuda</button>
        </div>

        <div class="debt-view-toggle" style="margin-bottom:12px">
          <button type="button" class="cal-type-btn${!isShared ? ' active' : ''}" onclick="Deudas._setScope('personal')">👤 Mis deudas</button>
          <button type="button" class="cal-type-btn${isShared ? ' active' : ''}" onclick="Deudas._setScope('shared')">🤝 Compartidas</button>
        </div>

        <div class="debt-summary-row">
          <div class="debt-pill owed-to-me">
            <div class="debt-pill-label">Me deben</div>
            <div class="debt-pill-amount">+${totalOwedToMe.toFixed(2)} €</div>
            <div class="debt-pill-count">${owedToMe.length} deuda${owedToMe.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="debt-pill i-owe">
            <div class="debt-pill-label">Debo yo</div>
            <div class="debt-pill-amount">-${totalIOwe.toFixed(2)} €</div>
            <div class="debt-pill-count">${iOwe.length} deuda${iOwe.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${pending.length > 0 ? `<div style="text-align:center;font-size:13px;padding:6px 0 2px;font-weight:600;color:${netTotal >= 0 ? 'var(--income)' : 'var(--expense)'}">
          Saldo neto: ${netTotal >= 0 ? '+' : ''}${netTotal.toFixed(2)} €
          <span style="font-size:11px;font-weight:400;color:var(--text-secondary);margin-left:4px">(${netBalances.length} persona${netBalances.length !== 1 ? 's' : ''})</span>
        </div>` : ''}
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Vista</span>
        </div>
        ${this._mainViewToggleHtml()}

        ${isNet
          ? (netBalances.length === 0
            ? '<div class="empty-state" style="padding:20px">Sin deudas pendientes 🎉</div>'
            : netBalances.map(e => this._renderNetPersonCard(e)).join(''))
          : /* legacy split view */ `
            <div style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:12px">
              <div class="card-header debt-section-header" style="padding:0 0 8px">
                <div>
                  <span class="card-title">🟢 Me deben</span>
                  ${owedToMe.length > 0 ? `<span class="debt-section-total income">+${totalOwedToMe.toFixed(2)} €</span>` : ''}
                </div>
                ${owedToMe.length > 0 ? this._viewToggleHtml('owed', this.viewMode.owed) : ''}
              </div>
              ${owedToMe.length === 0
                ? '<div class="empty-state" style="padding:10px">Nadie te debe dinero 🎉</div>'
                : (this.viewMode.owed === 'person'
                  ? peopleOwed.map(p => this._renderPersonCard(p, true)).join('')
                  : groupsOwed.map(g => this._renderDebtGroupCard(g, true)).join(''))}
            </div>
            <div>
              <div class="card-header debt-section-header" style="padding:0 0 8px">
                <div>
                  <span class="card-title">🔴 Debo yo</span>
                  ${iOwe.length > 0 ? `<span class="debt-section-total expense">-${totalIOwe.toFixed(2)} €</span>` : ''}
                </div>
                ${iOwe.length > 0 ? this._viewToggleHtml('iowe', this.viewMode.iowe) : ''}
              </div>
              ${iOwe.length === 0
                ? '<div class="empty-state" style="padding:10px">No debes dinero a nadie ✅</div>'
                : (this.viewMode.iowe === 'person'
                  ? peopleIOwe.map(p => this._renderPersonCard(p, false)).join('')
                  : groupsIOwe.map(g => this._renderDebtGroupCard(g, false)).join(''))}
            </div>`}
      </div>

      ${settled.length > 0 ? `
      <div class="card">
        <div class="card-header" onclick="this.nextElementSibling.classList.toggle('collapsed')" style="cursor:pointer">
          <span class="card-title">📋 Historial</span>
          <span style="font-size:12px;color:var(--text-secondary)">${settled.length} liquidada${settled.length !== 1 ? 's' : ''} ▾</span>
        </div>
        <div class="collapsible-body collapsed">
          ${settled.map(d => this._renderSettledCard(d)).join('')}
        </div>
      </div>` : ''}
    `;
  },

  _renderDebtMemberRow(d, isOwedToMe) {
    const { dateLabel, daysAgo, urgency } = this._dateMeta(d.date);
    return `<div class="debt-member-row">
      <div class="debt-member-main">
        <div class="debt-avatar debt-avatar-sm">${esc(d.person.charAt(0).toUpperCase())}</div>
        <div class="debt-info">
          <div class="debt-person">${esc(d.person)}</div>
          <div class="debt-meta">
            <span style="${urgency}">${dateLabel}${daysAgo > 0 ? ` · hace ${daysAgo}d` : ''}</span>
          </div>
        </div>
        <div class="debt-amount debt-amount-sm ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${d.amount.toFixed(2)}€</div>
      </div>
      <div class="debt-actions debt-actions-sm">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settle('${d.id}')">${isOwedToMe ? '✅' : '✅'}</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._edit('${d.id}')">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._delete('${d.id}')">🗑️</button>
      </div>
    </div>`;
  },

  _formatSplitBreakdown(splitLines) {
    if (!splitLines?.length) return '';
    return `<div class="split-breakdown-tags">${splitLines.map(l => {
      const label = l.label || (l.mode === 'equal' ? 'A medias' : l.mode === 'sole' && l.payer === 'me' ? 'Solo yo' : 'Partida');
      return `<span class="split-tag">${esc(label)} · ${(parseFloat(l.amount) || 0).toFixed(2)} €</span>`;
    }).join('')}</div>`;
  },

  _renderDebtGroupCard(group, isOwedToMe) {
    const expanded = !this._collapsedGroups.has(group.key);
    const { dateLabel, daysAgo, urgency } = this._dateMeta(group.date);
    const multi = group.debts.length > 1;
    const peopleLabel = group.debts.map(d => d.person).join(', ');
    const safeKey = group.key.replace(/'/g, "\\'");

    return `<div class="debt-card debt-group-card ${isOwedToMe ? 'debt-owed-to-me' : 'debt-i-owe'}">
      <div class="debt-group-header" onclick="Deudas._toggleGroup('${safeKey}')">
        <div class="debt-card-main" style="margin-bottom:0">
          <div class="debt-avatar">${multi ? '👥' : esc(group.primary.person.charAt(0).toUpperCase())}</div>
          <div class="debt-info">
            <div class="debt-person">${esc(group.description)}</div>
            <div class="debt-desc">${multi ? esc(peopleLabel) : esc(group.primary.person)}</div>
            <div class="debt-meta">
              <span style="${urgency}">${dateLabel}${daysAgo > 0 ? ` · hace ${daysAgo}d` : ''}</span>
              ${group.category ? `<span class="tx-adj-badge" style="background:var(--bg)">${esc(group.category)}</span>` : ''}
              ${group.linkedTxId ? `<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">📋 movimiento</span>` : ''}
              ${multi ? `<span class="tx-adj-badge">${group.debts.length} personas</span>` : ''}
              ${group.totalAmount ? `<span class="tx-adj-badge">Total ${group.totalAmount.toFixed(2)}€</span>` : ''}
            </div>
            ${this._formatSplitBreakdown(group.primary.splitLines)}
          </div>
          <div class="debt-amount ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${group.total.toFixed(2)}€</div>
          <span class="debt-chevron">${expanded ? '▾' : '▸'}</span>
        </div>
      </div>
      ${expanded ? `<div class="debt-group-members">
        ${group.debts.map(d => this._renderDebtMemberRow(d, isOwedToMe)).join('')}
      </div>` : ''}
      <div class="debt-actions">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settleGroup('${safeKey}', ${isOwedToMe})">
          ${isOwedToMe ? '✅ Cobrar todo' : '✅ Pagar todo'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._edit('${group.primary.id}')">✏️ Editar</button>
        ${group.linkedTxId ? `<button class="btn btn-secondary btn-sm" onclick="Deudas.openLinkToTx('${group.linkedTxId}')">📋 Mov.</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="Deudas._deleteGroup('${safeKey}')">🗑️</button>
      </div>
    </div>`;
  },

  _renderPersonCard(entry, isOwedToMe) {
    const key = this._personKey(entry.person, isOwedToMe);
    const expanded = !this._collapsedPersons.has(key);
    const safeKey = key.replace(/'/g, "\\'");
    const debtCount = entry.debts.length;

    return `<div class="debt-card debt-person-card ${isOwedToMe ? 'debt-owed-to-me' : 'debt-i-owe'}">
      <div class="debt-group-header" onclick="Deudas._togglePerson('${safeKey}')">
        <div class="debt-card-main" style="margin-bottom:0">
          <div class="debt-avatar">${esc(entry.person.charAt(0).toUpperCase())}</div>
          <div class="debt-info">
            <div class="debt-person">${esc(entry.person)}</div>
            <div class="debt-desc">${debtCount} deuda${debtCount !== 1 ? 's' : ''} pendiente${debtCount !== 1 ? 's' : ''}</div>
          </div>
          <div class="debt-amount ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${entry.total.toFixed(2)}€</div>
          <span class="debt-chevron">${expanded ? '▾' : '▸'}</span>
        </div>
      </div>
      ${expanded ? `<div class="debt-group-members">
        ${entry.debts.map(d => {
          const { dateLabel, daysAgo, urgency } = this._dateMeta(d.date);
          return `<div class="debt-member-row">
            <div class="debt-member-main">
              <div class="debt-info" style="margin-left:0">
                <div class="debt-person" style="font-size:13px">${esc(d.description || d.category || 'Sin descripción')}</div>
                <div class="debt-meta">
                  <span style="${urgency}">${dateLabel}${daysAgo > 0 ? ` · hace ${daysAgo}d` : ''}</span>
                  ${d.linkedTxId ? '<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">📋 mov.</span>' : ''}
                </div>
              </div>
              <div class="debt-amount debt-amount-sm ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${d.amount.toFixed(2)}€</div>
            </div>
            <div class="debt-actions debt-actions-sm">
              <button class="btn btn-primary btn-sm" onclick="Deudas._settle('${d.id}')">✅</button>
              <button class="btn btn-secondary btn-sm" onclick="Deudas._edit('${d.id}')">✏️</button>
              ${d.linkedTxId ? `<button class="btn btn-secondary btn-sm" onclick="Deudas.openLinkToTx('${d.linkedTxId}')">📋</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="Deudas._delete('${d.id}')">🗑️</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="debt-actions">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settlePerson('${entry.person.replace(/'/g, "\\'")}', ${isOwedToMe})">
          ${isOwedToMe ? '✅ Cobrar todo' : '✅ Pagar todo'}
        </button>
      </div>
    </div>`;
  },

  _renderSettledCard(d) {
    const isOwedToMe = (d.type || 'owed_to_me') === 'owed_to_me';
    const paidLabel  = d.paidDate ? new Date(d.paidDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
    return `<div class="debt-card debt-settled">
      <div class="debt-card-main">
        <div class="debt-avatar" style="opacity:0.5">${esc(d.person.charAt(0).toUpperCase())}</div>
        <div class="debt-info">
          <div class="debt-person" style="opacity:0.7">${esc(d.person)} <span class="tx-adj-badge" style="background:#D1FAE5;color:#065F46">liquidada</span></div>
          <div class="debt-desc">${esc(d.description || d.category || '')}</div>
          <div class="debt-meta"><span>${isOwedToMe ? 'Cobrado' : 'Pagado'} ${paidLabel}</span></div>
        </div>
        <div class="debt-amount" style="opacity:0.6">${isOwedToMe ? '+' : '-'}${d.amount.toFixed(2)}€</div>
      </div>
      <div class="debt-actions">
        <button class="btn btn-secondary btn-sm" onclick="Deudas._reopen('${d.id}')">↩ Reabrir</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._delete('${d.id}')">🗑️</button>
      </div>
    </div>`;
  },

  _openNew() {
    const today = new Date().toISOString().split('T')[0];
    App.openModal({
      title: '💸 Nueva deuda',
      body: this.debtFormHtml('debt', { date: today }),
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const meta = Deudas._readDebtFormMeta('debt');
          const created = Deudas._saveDebtsFromForm('debt', {
            ...meta,
            linkedTxId: meta.linkedTxId || null,
            skipAutoTx: !!meta.linkedTxId,
          });
          if (!created) return;
          Deudas._refreshAll();
          App.showToast(created.length > 1 ? `${created.length} deudas creadas` : `Deuda creada · ${created[0].person}`);
        }},
      ],
    });
    setTimeout(() => {
      Deudas._switchDebtType('owed_to_me', 'debt');
      document.getElementById('debtPerson')?.focus();
    }, 80);
  },

  _onLinkTxChange(prefix) {
    const txId = document.getElementById(prefix + 'LinkTx')?.value || document.getElementById('debtLinkTx')?.value;
    if (!txId) return;
    const t = Store.getTransactions().find(x => x.id === txId);
    if (!t) return;
    const totalEl = document.getElementById(prefix + 'Total');
    if (totalEl) { totalEl.value = t.amount; this._recalcSplit(prefix); }
    const manualTotalEl = document.getElementById(prefix + 'ManualTotal');
    if (manualTotalEl) { manualTotalEl.value = t.amount; this._recalcManualSplit(prefix); }
  },

  _switchDebtType(type, prefix = 'debt') {
    const typeEl = document.getElementById(prefix + 'Type');
    if (typeEl) typeEl.value = type;
    document.getElementById(prefix + 'TypeOwed')?.classList.toggle('active', type === 'owed_to_me');
    document.getElementById(prefix + 'TypeIOwe')?.classList.toggle('active', type === 'i_owe');
    const hint = document.getElementById(prefix + 'TypeHint');
    const isLink = prefix === 'link';
    if (hint) {
      hint.className = `debt-type-hint ${type === 'owed_to_me' ? 'owed-hint' : 'iowe-hint'}`;
      hint.textContent = type === 'owed_to_me'
        ? (isLink
          ? 'Pagaste tú este gasto. Registra quién te debe su parte.'
          : 'Pagaste tú el gasto entero. Se creará el movimiento automáticamente. Cuando te lo devuelvan, márcalo como cobrado.')
        : (isLink
          ? 'Alguien pagó por ti. El gasto queda pendiente hasta que lo pagues.'
          : 'Alguien pagó por ti. Se creará un movimiento pendiente que no afectará al saldo hasta que lo pagues.');
    }
    const linkGroup = document.getElementById(prefix + 'LinkGroup');
    if (linkGroup) linkGroup.style.display = type === 'owed_to_me' ? '' : 'none';
    // keep exclusions section in sync with type
    if (this._getSplitMode(prefix) === 'manual') {
      const isOwed = type === 'owed_to_me';
      const yoHint = document.querySelector(`#${prefix}ExclusionsSplitSection .excl-yo .excl-card-hint`);
      const otrHint = document.querySelector(`#${prefix}ExclusionsSplitSection .excl-otro .excl-card-hint`);
      if (yoHint) yoHint.textContent = isOwed ? 'Lo consumo/pago solo yo — no se reparte' : 'Mi parte personal';
      if (otrHint) otrHint.textContent = isOwed ? 'Esa persona lo consume entero → te lo debe' : 'Esa persona lo paga sola';
      this._recalcManualSplit(prefix);
    }
  },

  _findDebtsByGroupKey(key) {
    const pending = this._getPendingDebts();
    return pending.filter(d => this._debtGroupKey(d) === key);
  },

  _settle(id) {
    const d = this._getDebts().find(x => x.id === id);
    if (!d) return;
    const isOwedToMe = (d.type || 'owed_to_me') === 'owed_to_me';
    const sharedNote = this.scope === 'shared' ? ' (espacio compartido)' : '';
    const msg = isOwedToMe
      ? `¿Marcar como cobrado${sharedNote}? ${this.scope === 'shared' ? '' : `Se creará un ingreso de ${d.amount.toFixed(2)}€ de ${esc(d.person)}.`}`
      : `¿Marcar como pagado${sharedNote}? ${this.scope === 'shared' ? '' : `Se creará un gasto de ${d.amount.toFixed(2)}€ a ${esc(d.person)}.`}`;
    App.showConfirm(isOwedToMe ? '✅ Marcar cobrado' : '✅ Marcar pagado', msg, () => {
      const tx = this._scopeSettleDebt(id);
      this._refreshAll();
      App.showToast(tx ? `${isOwedToMe ? 'Cobrado' : 'Pagado'} ${d.amount.toFixed(2)}€ · movimiento creado` : 'Liquidado');
    });
  },

  _settleGroup(key, isOwedToMe) {
    const debts = this._findDebtsByGroupKey(key);
    if (!debts.length) return;
    const total = debts.reduce((s, d) => s + d.amount, 0);
    const msg = isOwedToMe
      ? `¿Marcar como cobradas ${debts.length} deuda(s) por un total de ${total.toFixed(2)}€?`
      : `¿Marcar como pagadas ${debts.length} deuda(s) por un total de ${total.toFixed(2)}€?`;
    App.showConfirm(isOwedToMe ? '✅ Cobrar todo' : '✅ Pagar todo', msg, () => {
      debts.forEach(d => this._scopeSettleDebt(d.id));
      this._refreshAll();
      App.showToast(`${debts.length} deuda(s) liquidada(s) · ${total.toFixed(2)}€`);
    });
  },

  _settlePerson(person, isOwedToMe) {
    const debts = this._getPendingDebts().filter(d =>
      d.person === person && ((d.type || 'owed_to_me') === 'owed_to_me') === isOwedToMe
    );
    if (!debts.length) return;
    const total = debts.reduce((s, d) => s + d.amount, 0);
    const msg = isOwedToMe
      ? `¿Marcar como cobradas todas las deudas de ${esc(person)} (${total.toFixed(2)}€)?`
      : `¿Marcar como pagadas todas las deudas con ${esc(person)} (${total.toFixed(2)}€)?`;
    App.showConfirm(isOwedToMe ? '✅ Cobrar todo' : '✅ Pagar todo', msg, () => {
      debts.forEach(d => this._scopeSettleDebt(d.id));
      this._refreshAll();
      App.showToast(`${person}: ${debts.length} deuda(s) liquidada(s)`);
    });
  },

  _deleteGroup(key) {
    const debts = this._findDebtsByGroupKey(key);
    if (!debts.length) return;
    App.showConfirm('Eliminar deudas', `¿Eliminar ${debts.length} deuda(s) de este grupo?`, () => {
      debts.forEach(d => this._scopeDeleteDebt(d.id));
      this._refreshAll();
      App.showToast('Deudas eliminadas');
    });
  },

  _edit(id) {
    const d = Store.getDebts().find(x => x.id === id);
    if (!d || d.isPaid) return;
    const related = this._getRelatedDebts(d);
    const selected = related.map(r => r.person);
    const prefix = 'edit';
    const splitCount = d.splitCount || Math.max(2, selected.length + 1);
    const totalAmount = d.totalAmount || d.amount * splitCount;
    const splitLines = d.splitLines || null;
    const splitMode = splitLines ? 'manual' : 'simple';

    App.openModal({
      title: `✏️ Editar deuda${related.length > 1 ? ` (${related.length})` : ''}`,
      body: this.debtFormHtml(prefix, {
        type: d.type || 'owed_to_me',
        totalAmount,
        splitCount,
        selectedPeople: selected,
        description: d.description || '',
        category: d.category || 'Otros',
        date: d.date || '',
        linkedTxId: d.linkedTxId || '',
        showLink: true,
        splitMode,
        splitLines,
      }),
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const meta = Deudas._readDebtFormMeta(prefix);
          const created = Deudas._replaceDebts(related, prefix, meta);
          if (!created) return;
          Deudas._refreshAll();
          App.showToast(created.length > 1 ? `${created.length} deudas actualizadas` : `Deuda actualizada · ${created[0].person}`);
        }},
      ],
    });
    setTimeout(() => {
      Deudas._setSelectedPeople(prefix, selected);
      Deudas._switchDebtType(d.type || 'owed_to_me', prefix);
      if (splitMode === 'manual') {
        Deudas._switchSplitMode(prefix, 'manual');
        Deudas._updateExclusionsPersonLabel(prefix, selected);
        const allCustom = splitLines?.every(l => l.mode === 'custom');
        if (allCustom && splitLines?.length) {
          Deudas._switchManualSubMode(prefix, 'byperson');
          related.forEach(r => {
            const inp = document.getElementById(Deudas._personFieldId(prefix, r.person));
            if (inp) inp.value = r.amount;
          });
        } else if (splitLines?.some(l => l.mode === 'custom') || splitLines?.length > 2) {
          Deudas._switchManualSubMode(prefix, 'lines');
        } else if (splitLines?.length) {
          Deudas._switchManualSubMode(prefix, 'quick');
        }
        Deudas._recalcManualSplit(prefix);
      }
      document.getElementById(prefix + 'Person')?.focus();
    }, 80);
  },

  _delete(id) {
    App.showConfirm('Eliminar deuda', '¿Eliminar esta deuda?', () => {
      this._scopeDeleteDebt(id);
      this._refreshAll();
    });
  },

  _reopen(id) {
    this._scopeReopenDebt(id);
    this._refreshAll();
    App.showToast('Deuda reabierta');
  },

  /** Called from other tabs to quickly record that someone owes you */
  openNewOwedToMe(prefill = {}) {
    this._openNew();
    setTimeout(() => {
      Deudas._switchDebtType('owed_to_me', 'debt');
      if (prefill.person) Deudas._setSelectedPeople('debt', [prefill.person]);
      if (prefill.amount) {
        const totalEl = document.getElementById('debtTotal');
        const amtEl = document.getElementById('debtAmount');
        if (totalEl) totalEl.value = prefill.amount;
        if (amtEl) amtEl.value = prefill.amount;
      }
      if (prefill.desc) document.getElementById('debtDesc').value = prefill.desc;
      if (prefill.linkedTxId) {
        document.getElementById('debtLinkTx').value = prefill.linkedTxId;
        Deudas._onLinkTxChange('debt');
      }
    }, 120);
  },

  // ── Inline debt block (embedded in movement forms) ─────────────────────────

  /** Called from Movimientos/Calendario to associate a debt with an existing expense */
  openLinkToTx(txId) {
    const t = Store.getTransactions().find(x => x.id === txId);
    if (!t || !Store.isDebtExpense(t)) {
      App.showToast('Solo se puede vincular a gastos');
      return;
    }
    const existing = Store.getDebtsByLinkedTx(txId);
    const prefillSelected = existing.map(d => d.person);
    const prefillType = existing[0]?.type || 'owed_to_me';
    const prefillTotal = existing[0]?.totalAmount || t.amount;
    const prefillSplit = existing[0]?.splitCount || Math.max(2, prefillSelected.length + 1);

    App.openModal({
      title: existing.length ? '💸 Editar deudas del movimiento' : '💸 Asociar deuda a movimiento',
      body: this.debtFormHtml('link', {
        type: prefillType,
        totalAmount: prefillTotal,
        splitCount: prefillSplit,
        selectedPeople: prefillSelected,
        description: t.description || '',
        category: t.category,
        date: t.date,
        showLink: false,
        showTxBanner: {
          date: t.date.split('-').reverse().join('/'),
          description: t.description || t.category,
          amount: `${t.amount.toFixed(2)}€`,
          debtCount: existing.length || null,
        },
      }),
      actions: [
        { label: 'Cancelar' },
        { label: existing.length ? '💾 Guardar' : '💸 Vincular', primary: true, cb: () => {
          const meta = Deudas._readDebtFormMeta('link');
          const created = Deudas._saveDebtsFromForm('link', {
            ...meta,
            category: meta.category || t.category,
            date: meta.date || t.date,
            linkedTxId: txId,
          });
          if (!created) return;
          Deudas._refreshAll();
          App.showToast(created.length > 1 ? `${created.length} deudas vinculadas` : `Deuda vinculada con ${created[0].person}`);
        }},
      ],
    });
    setTimeout(() => {
      if (prefillSelected.length) Deudas._setSelectedPeople('link', prefillSelected);
      Deudas._switchDebtType(prefillType, 'link');
      document.getElementById('linkPerson')?.focus();
    }, 80);
  },

  /** Returns the HTML snippet to embed inside a movement add/edit form.
   *  existingDebt: optional debt object already linked to this tx */
  inlineFormHtml(prefix = 'tx', defaultAmount = '', defaultDesc = '', existingDebt = null, allDebts = null) {
    const debts = allDebts || (existingDebt ? [existingDebt] : []);
    const enabled = debts.length > 0;
    const debtType = debts[0]?.type || 'owed_to_me';
    const selected = debts.map(d => d.person);
    const total = debts[0]?.totalAmount || defaultAmount || '';
    const splitCount = debts[0]?.splitCount || Math.max(2, selected.length + 1);
    const splitLines = debts[0]?.splitLines || null;
    const isManual = !!splitLines;
    const amountsByPerson = {};
    debts.forEach(d => { amountsByPerson[d.person] = d.amount; });
    return `
      <div class="debt-inline-block" id="${prefix}DebtBlock">
        <label class="debt-inline-toggle" onclick="Deudas.toggleInlineDebt('${prefix}')">
          <input type="checkbox" id="${prefix}DebtEnabled" style="margin-right:6px"${enabled ? ' checked' : ''}>
          💸 ${enabled ? `Deuda${debts.length > 1 ? 's' : ''} vinculada${debts.length > 1 ? ' (' + debts.length + ')' : ''}` : 'Asociar deuda a este movimiento'}
        </label>
        <div id="${prefix}DebtFields" style="display:${enabled ? '' : 'none'};margin-top:10px;padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
          ${debts.length ? `<input type="hidden" id="${prefix}DebtExistingIds" value="${debts.map(d => d.id).join('|')}">` : ''}
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <button type="button" class="cal-type-btn${debtType === 'owed_to_me' ? ' active' : ''}" id="${prefix}DebtTypeOwed" onclick="Deudas._toggleInlineType('${prefix}','owed_to_me')">🟢 Me deben</button>
            <button type="button" class="cal-type-btn${debtType === 'i_owe' ? ' active' : ''}" id="${prefix}DebtTypeIOwe" onclick="Deudas._toggleInlineType('${prefix}','i_owe')">🔴 Debo yo</button>
          </div>
          <input type="hidden" id="${prefix}DebtType" value="${debtType}">
          <input type="hidden" id="${prefix}Type" value="${debtType}">
          <div id="${prefix}DebtHint" class="debt-type-hint ${debtType === 'owed_to_me' ? 'owed-hint' : 'iowe-hint'}" style="margin-bottom:8px;font-size:12px">
            ${debtType === 'owed_to_me'
              ? 'Pagaste tú el gasto. Cuando te lo devuelvan, márcalo como cobrado en Deudas.'
              : 'Alguien pagó por ti. El gasto NO se descuenta hasta que lo pagues en Deudas.'}
          </div>
          ${this._splitModeHtml(prefix, total, splitCount, isManual ? 'manual' : 'simple', splitLines, debtType)}
          ${this.personPickerHtml(prefix, selected)}
          ${enabled ? `<button type="button" class="btn btn-sm btn-danger" style="margin-top:8px;width:100%" onclick="Deudas._unlinkInlineDebts('${prefix}')">✕ Quitar vinculación</button>` : ''}
        </div>
      </div>`;
  },

  _unlinkInlineDebts(prefix) {
    const raw = document.getElementById(prefix + 'DebtExistingIds')?.value || '';
    const ids = raw.split('|').filter(Boolean);
    App.showConfirm('Quitar deudas', `¿Eliminar ${ids.length || 'las'} deuda(s) vinculada(s)?`, () => {
      ids.forEach(id => Store.deleteDebt(id));
      const block = document.getElementById(prefix + 'DebtBlock')?.parentElement;
      if (block) block.innerHTML = Deudas.inlineFormHtml(prefix);
      Deudas._refreshAll();
      App.showToast('Deudas desvinculadas');
    });
  },

  toggleInlineDebt(prefix) {
    const cb     = document.getElementById(prefix + 'DebtEnabled');
    const fields = document.getElementById(prefix + 'DebtFields');
    if (fields) fields.style.display = cb?.checked ? '' : 'none';
  },

  _toggleInlineType(prefix, type) {
    document.getElementById(prefix + 'DebtType').value = type;
    const typeEl = document.getElementById(prefix + 'Type');
    if (typeEl) typeEl.value = type;
    document.getElementById(prefix + 'DebtTypeOwed').classList.toggle('active', type === 'owed_to_me');
    document.getElementById(prefix + 'DebtTypeIOwe').classList.toggle('active', type === 'i_owe');
    const hint = document.getElementById(prefix + 'DebtHint');
    if (hint) {
      hint.className = `debt-type-hint ${type === 'owed_to_me' ? 'owed-hint' : 'iowe-hint'}`;
      hint.textContent = type === 'owed_to_me'
        ? 'Pagaste tú el gasto. Cuando te lo devuelvan, márcalo como cobrado en Deudas.'
        : 'Alguien pagó por ti. El gasto NO se descuenta hasta que lo pagues en Deudas.';
    }
  },

  /** Reads inline debt fields and creates/updates a debt if enabled.
   *  Returns true if a debt was saved. */
  saveInlineDebt(prefix, txId, txDate, txDesc, txCategory) {
    const enabled = document.getElementById(prefix + 'DebtEnabled')?.checked;
    const existingRaw = document.getElementById(prefix + 'DebtExistingIds')?.value || '';
    const existingIds = existingRaw.split('|').filter(Boolean);
    if (!enabled) {
      existingIds.forEach(id => Store.deleteDebt(id));
      return false;
    }
    const type = document.getElementById(prefix + 'DebtType')?.value || 'owed_to_me';
    existingIds.forEach(id => Store.deleteDebt(id));
    const created = this._saveDebtsFromForm(prefix, {
      type, description: txDesc || '', category: txCategory || 'Otros', date: txDate, linkedTxId: txId,
    });
    if (!created) return false;
    if (document.getElementById('tab-deudas')?.classList.contains('active')) this.render();
    Dashboard.render();
    if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
    if (document.getElementById('tab-calendario')?.classList.contains('active')) Calendario.render();
    App._refreshConfigDependents?.();
    App.showToast(created.length > 1 ? `${created.length} deudas vinculadas` : 'Deuda vinculada');
    return true;
  },

  debtBadgeHtml(txId) {
    const debts = Store.getDebtsByLinkedTx(txId);
    if (!debts.length) return '';
    if (debts.length === 1) {
      const debt = debts[0];
      const isOwed = (debt.type || 'owed_to_me') === 'owed_to_me';
      return `<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5" title="${isOwed ? 'Me debe' : 'Debo a'} ${esc(debt.person)}">💸 ${esc(debt.person)}</span>`;
    }
    const names = debts.map(d => d.person).slice(0, 2).join(', ');
    return `<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5" title="${debts.map(d => d.person + ' ' + d.amount.toFixed(2) + '€').join(', ')}">💸 ${esc(names)}${debts.length > 2 ? ' +' + (debts.length - 2) : ''}</span>`;
  },
};
