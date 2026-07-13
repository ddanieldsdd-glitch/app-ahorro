const Deudas = {

  render() {
    const el = document.getElementById('tab-deudas');
    if (!el) return;

    const pending   = Store.getPendingDebts();
    const owedToMe  = pending.filter(d => (d.type || 'owed_to_me') === 'owed_to_me');
    const iOwe      = pending.filter(d => d.type === 'i_owe');
    const settled   = Store.getSettledDebts().sort((a, b) => b.paidDate?.localeCompare(a.paidDate || '') || 0);

    const totalOwedToMe = owedToMe.reduce((s, d) => s + d.amount, 0);
    const totalIOwe     = iOwe.reduce((s, d) => s + d.amount, 0);

    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">💸 Deudas</span>
          <button class="btn btn-primary btn-sm" onclick="Deudas._openNew()">+ Nueva deuda</button>
        </div>

        <!-- Summary pills -->
        <div class="debt-summary-row">
          <div class="debt-pill owed-to-me">
            <div class="debt-pill-label">Me deben</div>
            <div class="debt-pill-amount">+${totalOwedToMe.toFixed(2)} €</div>
            <div class="debt-pill-count">${owedToMe.length} pendiente${owedToMe.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="debt-pill i-owe">
            <div class="debt-pill-label">Debo yo</div>
            <div class="debt-pill-amount">-${totalIOwe.toFixed(2)} €</div>
            <div class="debt-pill-count">${iOwe.length} pendiente${iOwe.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      <!-- Me deben -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🟢 Me deben</span>
          ${owedToMe.length > 0 ? `<span style="font-size:12px;color:var(--income);font-weight:700">+${totalOwedToMe.toFixed(2)} €</span>` : ''}
        </div>
        ${owedToMe.length === 0
          ? '<div class="empty-state" style="padding:20px">Nadie te debe dinero 🎉</div>'
          : owedToMe.sort((a, b) => a.date.localeCompare(b.date)).map(d => this._renderDebtCard(d)).join('')}
      </div>

      <!-- Debo yo -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔴 Debo yo</span>
          ${iOwe.length > 0 ? `<span style="font-size:12px;color:var(--expense);font-weight:700">-${totalIOwe.toFixed(2)} €</span>` : ''}
        </div>
        ${iOwe.length === 0
          ? '<div class="empty-state" style="padding:20px">No debes dinero a nadie ✅</div>'
          : iOwe.sort((a, b) => a.date.localeCompare(b.date)).map(d => this._renderDebtCard(d)).join('')}
      </div>

      <!-- Historial -->
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

  _renderDebtCard(d) {
    const isOwedToMe = (d.type || 'owed_to_me') === 'owed_to_me';
    const dateLabel  = d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';
    const daysAgo    = d.date ? Math.floor((Date.now() - new Date(d.date + 'T00:00:00')) / 86400000) : 0;
    const urgency    = daysAgo > 30 ? 'color:var(--expense)' : daysAgo > 14 ? 'color:#F59E0B' : 'color:var(--text-secondary)';

    return `<div class="debt-card ${isOwedToMe ? 'debt-owed-to-me' : 'debt-i-owe'}">
      <div class="debt-card-main">
        <div class="debt-avatar">${esc(d.person.charAt(0).toUpperCase())}</div>
        <div class="debt-info">
          <div class="debt-person">${esc(d.person)}</div>
          <div class="debt-desc">${esc(d.description || d.category || '')}</div>
          <div class="debt-meta">
            <span style="${urgency}">${dateLabel}${daysAgo > 0 ? ` · hace ${daysAgo}d` : ''}</span>
            ${d.category ? `<span class="tx-adj-badge" style="background:var(--bg)">${esc(d.category)}</span>` : ''}
            ${d.linkedTxId ? '<span class="tx-adj-badge" style="background:#E0E7FF;color:#4F46E5">vinculado</span>' : ''}
          </div>
        </div>
        <div class="debt-amount ${isOwedToMe ? 'income' : 'expense'}">${isOwedToMe ? '+' : '-'}${d.amount.toFixed(2)}€</div>
      </div>
      <div class="debt-actions">
        <button class="btn btn-primary btn-sm" onclick="Deudas._settle('${d.id}')">
          ${isOwedToMe ? '✅ Cobrado' : '✅ Pagado'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._edit('${d.id}')">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="Deudas._delete('${d.id}')">🗑️</button>
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
    const categories = Store.getCategories();
    const today = new Date().toISOString().split('T')[0];
    App.openModal({
      title: '💸 Nueva deuda',
      body: `
        <div style="display:flex;gap:6px;margin-bottom:14px">
          <button type="button" class="cal-type-btn active" id="debtTypeOwed" onclick="Deudas._switchDebtType('owed_to_me')">🟢 Me deben</button>
          <button type="button" class="cal-type-btn" id="debtTypeIOwe" onclick="Deudas._switchDebtType('i_owe')">🔴 Debo yo</button>
        </div>
        <input type="hidden" id="debtType" value="owed_to_me">
        <div id="debtTypeHint" class="debt-type-hint owed-hint">
          Pagaste tú el gasto entero. Se cobra al instante. Cuando te lo devuelvan, márca como cobrado.
        </div>
        <div class="form-group">
          <label>Persona</label>
          <input type="text" id="debtPerson" placeholder="Nombre" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group">
          <label>Importe (€)</label>
          <input type="number" id="debtAmount" step="0.01" min="0.01" placeholder="0.00" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="debtDesc" placeholder="Ej: Cena, gasolina..." maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="debtCategory" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="debtDate" value="${today}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group" id="debtLinkGroup" style="display:none">
          <label>Vincular a movimiento existente (opcional)</label>
          <select id="debtLinkTx" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            <option value="">— Sin vincular —</option>
            ${Store.getTransactions().filter(t => Store.isExpense(t)).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 30).map(t =>
              `<option value="${t.id}">${t.date.split('-').reverse().join('/')} · ${esc(t.description || t.category)} · ${t.amount.toFixed(2)}€</option>`
            ).join('')}
          </select>
        </div>`,
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const person   = document.getElementById('debtPerson')?.value.trim();
          const amount   = parseFloat(document.getElementById('debtAmount')?.value);
          const desc     = document.getElementById('debtDesc')?.value.trim();
          const category = document.getElementById('debtCategory')?.value;
          const date     = document.getElementById('debtDate')?.value;
          const type     = document.getElementById('debtType')?.value;
          const linkedTxId = document.getElementById('debtLinkTx')?.value || null;
          if (!person) { App.showToast('Escribe un nombre'); return; }
          if (!amount || amount <= 0) { App.showToast('Importe inválido'); return; }
          Store.addDebt({ person, amount, description: desc, category, date, type, linkedTxId });
          Deudas.render();
          Dashboard.render();
          App.showToast(`Deuda registrada con ${person}`);
        }},
      ],
    });
    setTimeout(() => document.getElementById('debtPerson')?.focus(), 80);
  },

  _switchDebtType(type) {
    document.getElementById('debtType').value = type;
    document.getElementById('debtTypeOwed').classList.toggle('active', type === 'owed_to_me');
    document.getElementById('debtTypeIOwe').classList.toggle('active', type === 'i_owe');
    const hint = document.getElementById('debtTypeHint');
    if (hint) {
      hint.className = `debt-type-hint ${type === 'owed_to_me' ? 'owed-hint' : 'iowe-hint'}`;
      hint.textContent = type === 'owed_to_me'
        ? 'Pagaste tú el gasto entero. Se cobra al instante. Cuando te lo devuelvan, márcalo como cobrado.'
        : 'Alguien pagó por ti. El gasto NO se descuenta hasta que lo pagues. Márcalo como pagado cuando lo hagas.';
    }
    const linkGroup = document.getElementById('debtLinkGroup');
    if (linkGroup) linkGroup.style.display = type === 'owed_to_me' ? '' : 'none';
  },

  _settle(id) {
    const d = Store.getDebts().find(x => x.id === id);
    if (!d) return;
    const isOwedToMe = (d.type || 'owed_to_me') === 'owed_to_me';
    const msg = isOwedToMe
      ? `¿Marcar como cobrado? Se creará un ingreso de ${d.amount.toFixed(2)}€ de ${esc(d.person)}.`
      : `¿Marcar como pagado? Se creará un gasto de ${d.amount.toFixed(2)}€ a ${esc(d.person)}.`;
    App.showConfirm(isOwedToMe ? '✅ Marcar cobrado' : '✅ Marcar pagado', msg, () => {
      const tx = Store.settleDebt(id);
      Deudas.render();
      Dashboard.render();
      if (document.getElementById('tab-registro')?.classList.contains('active')) Registro.render();
      App.showToast(tx ? `${isOwedToMe ? 'Cobrado' : 'Pagado'} ${d.amount.toFixed(2)}€ · ${tx.type} creado` : 'Liquidado');
    });
  },

  _edit(id) {
    const d = Store.getDebts().find(x => x.id === id);
    if (!d) return;
    const categories = Store.getCategories();
    App.openModal({
      title: '✏️ Editar deuda',
      body: `
        <div class="form-group">
          <label>Persona</label>
          <input type="text" id="editDebtPerson" value="${esc(d.person)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group">
          <label>Importe (€)</label>
          <input type="number" id="editDebtAmount" value="${d.amount}" step="0.01" min="0.01" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700">
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="editDebtDesc" value="${esc(d.description || '')}" maxlength="100" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="editDebtCategory" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
            ${categories.map(c => `<option value="${esc(c)}"${c === d.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="editDebtDate" value="${d.date || ''}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>`,
      actions: [
        { label: 'Cancelar' },
        { label: '💾 Guardar', primary: true, cb: () => {
          const person   = document.getElementById('editDebtPerson')?.value.trim();
          const amount   = parseFloat(document.getElementById('editDebtAmount')?.value);
          const desc     = document.getElementById('editDebtDesc')?.value.trim();
          const category = document.getElementById('editDebtCategory')?.value;
          const date     = document.getElementById('editDebtDate')?.value;
          if (!person || !amount || amount <= 0) { App.showToast('Datos inválidos'); return; }
          Store.updateDebt(id, { person, amount, description: desc, category, date });
          Deudas.render();
          Dashboard.render();
        }},
      ],
    });
  },

  _delete(id) {
    App.showConfirm('Eliminar deuda', '¿Eliminar esta deuda?', () => {
      Store.deleteDebt(id);
      Deudas.render();
      Dashboard.render();
    });
  },

  _reopen(id) {
    Store.updateDebt(id, { isPaid: false, paidDate: null, paidTxId: null });
    Deudas.render();
    Dashboard.render();
    App.showToast('Deuda reabierta');
  },

  /** Called from other tabs to quickly record that someone owes you */
  openNewOwedToMe(prefill = {}) {
    this._openNew();
    setTimeout(() => {
      document.getElementById('debtType').value = 'owed_to_me';
      if (prefill.person)   document.getElementById('debtPerson').value  = prefill.person;
      if (prefill.amount)   document.getElementById('debtAmount').value  = prefill.amount;
      if (prefill.desc)     document.getElementById('debtDesc').value    = prefill.desc;
      if (prefill.linkedTxId) document.getElementById('debtLinkTx').value = prefill.linkedTxId;
    }, 120);
  },
};
