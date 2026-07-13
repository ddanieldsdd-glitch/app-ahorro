const Categorias = {
  render() {
    const el = document.getElementById('tab-categorias');
    const checking = Store.getCheckingBalance();
    const savings = Store.getSavingsBalance();
    const transfers = Store.getTransfers();
    const totalWealth = checking !== null && checking !== undefined ? checking + savings : savings;
    const baseBalance = Store.getCheckingBaseBalance();
    const checkingAvailable = checking !== null ? Math.max(0, checking - baseBalance) : 0;

    el.innerHTML = `
      <div class="sa-card sa-card-cuentas" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">🏦 Mis cuentas</span></div>
        <div class="sa-cuentas-grid">
          <div class="sa-cuenta">
            <div class="sa-cuenta-icon" style="background:#EEF2FF;color:var(--primary)">💳</div>
            <div class="sa-cuenta-info">
              <span class="sa-cuenta-label">Cuenta corriente</span>
              <div style="display:flex;align-items:center;gap:6px">
                ${checking !== null && checking !== undefined ? `<span class="sa-cuenta-val">${checking.toFixed(2)} €</span>` : '<span class="sa-cuenta-val" style="color:var(--text-secondary)">Sin registrar</span>'}
                <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px" onclick="Categorias._setBalance('checking')">✏️</button>
              </div>
            </div>
          </div>
          ${checking !== null ? `<div class="sa-cuenta-split">
            <span>🔒 Base guardada: <strong>${baseBalance.toFixed(2)} €</strong> <button class="btn-sm" style="border:none;background:none;cursor:pointer;font-size:11px;color:var(--primary)" onclick="Categorias._setBaseBalance()">✏️</button></span>
            <span>💸 Disponible: <strong style="color:var(--income)">${checkingAvailable.toFixed(2)} €</strong></span>
          </div>` : ''}
          <div class="sa-cuenta">
            <div class="sa-cuenta-icon" style="background:#ECFDF5;color:var(--income)">🐷</div>
            <div class="sa-cuenta-info">
              <span class="sa-cuenta-label">Cuenta ahorro</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="sa-cuenta-val" style="color:var(--income)">${savings.toFixed(2)} €</span>
                <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px" onclick="Categorias._setBalance('savings')">✏️</button>
              </div>
            </div>
          </div>
        </div>
        ${checking !== null && checking !== undefined ? `<div class="sa-cuenta-total">💵 Patrimonio total: <strong>${totalWealth.toFixed(2)} €</strong></div>` : `<div class="sa-cuenta-total">🐷 Ahorro acumulado: <strong>${savings.toFixed(2)} €</strong></div>`}
        <div class="sa-transfer-form">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">Registrar transferencia → ahorro:</span>
            <input type="number" id="transferAmount" placeholder="€" step="1" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-weight:700">
            <input type="text" id="transferNote" placeholder="Nota (opcional)" style="flex:1;min-width:100px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px">
            <button class="btn btn-primary btn-sm" onclick="Categorias._doTransfer()">+ Transferir</button>
          </div>
          <div id="transferFeedback" style="font-size:12px;margin-top:4px;color:var(--income);display:none"></div>
        </div>
        ${transfers.length > 0 ? `<div class="sa-transfer-list"><div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">Últimas transferencias:</div>
          ${transfers.slice(-5).reverse().map(t => `<div class="sa-transfer-item"><span>${t.date}</span><span style="font-weight:700;color:var(--income)">+${t.amount.toFixed(2)}€</span>${t.note ? `<span style="color:var(--text-secondary)">${esc(t.note)}</span>` : ''}<button class="btn-sm" style="margin-left:auto;border:none;background:none;cursor:pointer;color:var(--text-secondary);font-size:11px" onclick="Categorias._undoTransfer('${t.id}')">✕</button></div>`).join('')}
        </div>` : ''}
      </div>

      <div class="cat-grid">
        <div class="cat-section">
          <div class="cat-section-title">
            <span>Categorías</span>
          </div>
          <div class="cat-list" id="catList"></div>
          <div class="add-cat-form">
            <input type="text" id="newCategory" placeholder="Nueva categoría...">
            <button onclick="Categorias._add('category')">Añadir</button>
          </div>
        </div>
        <div class="cat-section">
          <div class="cat-section-title">
            <span>Tipos</span>
          </div>
          <div class="cat-list" id="typeList"></div>
          <div class="add-cat-form">
            <input type="text" id="newType" placeholder="Nuevo tipo...">
            <button onclick="Categorias._add('type')">Añadir</button>
          </div>
        </div>
        <div class="cat-section">
          <div class="cat-section-title">
            <span>Métodos de pago</span>
          </div>
          <div class="cat-list" id="methodList"></div>
          <div class="add-cat-form">
            <input type="text" id="newMethod" placeholder="Nuevo método...">
            <button onclick="Categorias._add('method')">Añadir</button>
          </div>
        </div>
      </div>
    `;

    this._renderList('catList', Store.getCategories(), 'category');
    this._renderList('typeList', Store.getTypes(), 'type');
    this._renderList('methodList', Store.getPaymentMethods(), 'method');

    document.getElementById('newCategory').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('category'); });
    document.getElementById('newType').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('type'); });
    document.getElementById('newMethod').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('method'); });
  },

  _renderList(listId, items, type) {
    const el = document.getElementById(listId);
    const usedItems = this._getUsedItems(type);
    el.innerHTML = items.map(item => {
      const inUse = usedItems.has(item);
      return `
        <div class="cat-item">
          <span class="cat-name">${item}</span>
          <button class="delete-cat" onclick="Categorias._delete('${type}', '${item.replace(/'/g, "\\'")}')"
            ${inUse ? `title="En uso por algún movimiento"` : ''}
            style="${inUse ? 'opacity:0.4;cursor:not-allowed' : ''}">✕</button>
        </div>
      `;
    }).join('');
  },

  _getUsedItems(type) {
    const transactions = Store.getTransactions();
    const archives = Store.getArchives();
    const used = new Set();

    const checkTx = (tx) => {
      if (type === 'category') used.add(tx.category);
      else if (type === 'type') used.add(tx.type);
      else if (type === 'method') used.add(tx.paymentMethod);
    };

    transactions.forEach(checkTx);
    Object.values(archives).forEach(txs => txs.forEach(checkTx));

    return used;
  },

  _add(type) {
    const inputId = { category: 'newCategory', type: 'newType', method: 'newMethod' }[type];
    const input = document.getElementById(inputId);
    const name = input.value.trim();
    if (!name) return;

    if (type === 'category') Store.addCategory(name);
    else if (type === 'type') Store.addType(name);
    else Store.addPaymentMethod(name);

    input.value = '';
    this.render();
    Registro.render();
  },

  _delete(type, name) {
    const usedItems = this._getUsedItems(type);
    if (usedItems.has(name)) return;

    App.showConfirm('Eliminar', `¿Eliminar "${name}"?`, () => {
      if (type === 'category') Store.deleteCategory(name);
      else if (type === 'type') Store.deleteType(name);
      else Store.deletePaymentMethod(name);
      this.render();
      Registro.render();
    });
  },

  _setBaseBalance() {
    const current = Store.getCheckingBaseBalance();
    App.showCustom('🔒 Base en cuenta corriente', `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Cantidad mínima que quieres mantener siempre en tu cuenta. La app mostrará el resto como "disponible".</p>
      <div class="form-group"><label>Base (€)</label>
        <input type="number" id="baseBalanceInput" value="${current}" step="10" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700;width:100%">
      </div>
    `, 'Guardar', () => {
      const v = parseFloat(document.getElementById('baseBalanceInput').value);
      if (!isNaN(v) && v >= 0) { Store.setCheckingBaseBalance(v); Categorias.render(); }
      else App._closeModal();
    });
  },

  _setBalance(type) {
    const computed = type === 'checking' ? (Store.getCheckingBalance() ?? 0) : (Store.getSavingsBalance() || 0);
    const initialKey = type === 'checking' ? 'Saldo inicial (corriente)' : 'Saldo inicial (ahorro)';
    const initialVal = type === 'checking' ? Store.getInitialCheckingBalance() : Store.getInitialSavingsBalance();
    const label = type === 'checking' ? 'Cuenta corriente' : 'Cuenta ahorro';
    const icon = type === 'checking' ? '💳' : '🐷';

    App.showCustom(`${icon} Sincronizar ${label}`, `
      <div style="background:var(--bg);border-radius:8px;padding:10px 14px;margin-bottom:14px">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">Saldo calculado por la app (automático)</div>
        <div style="font-size:22px;font-weight:800;color:var(--primary)">${computed.toFixed(2)} €</div>
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label>${initialKey} (punto de partida)</label>
        <input type="number" id="balInitial" value="${initialVal.toFixed(2)}" step="0.01"
          style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:15px;font-weight:700;width:100%">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">El saldo que tenías antes de empezar a usar la app.</div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px">— O ajustar para cuadrar con el banco —</div>
        <div class="form-group">
          <label>Saldo real en el banco ahora (€)</label>
          <input type="number" id="balAdjust" placeholder="${computed.toFixed(2)}" step="0.01"
            style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:16px;font-weight:700;width:100%">
        </div>
        <input type="text" id="balAdjustNote" placeholder="Nota del ajuste (opcional)"
          style="width:100%;margin-top:6px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Se creará un movimiento de ajuste para cuadrar la diferencia.</div>
      </div>
    `, 'Guardar', () => {
      const initVal = parseFloat(document.getElementById('balInitial').value);
      const adjustVal = parseFloat(document.getElementById('balAdjust').value);
      const note = document.getElementById('balAdjustNote').value.trim();

      if (!isNaN(initVal)) {
        if (type === 'checking') Store.setInitialCheckingBalance(initVal);
        else Store.setInitialSavingsBalance(initVal);
      }

      if (!isNaN(adjustVal) && adjustVal !== computed) {
        Store.addAdjustmentTransaction(type, adjustVal, note || undefined);
      }

      Categorias.render();
    });
  },

  _doTransfer() {
    const amt = parseFloat(document.getElementById('transferAmount').value);
    const note = document.getElementById('transferNote').value.trim();
    if (!amt || amt <= 0) return;
    const checking = Store.getCheckingBalance();
    if (checking !== null && checking !== undefined && amt > checking) {
      document.getElementById('transferFeedback').style.display = 'block';
      document.getElementById('transferFeedback').style.color = 'var(--expense)';
      document.getElementById('transferFeedback').textContent = '❌ No tienes suficiente saldo en la cuenta corriente';
      return;
    }
    Store.addTransfer(amt, note);
    if (checking !== null && checking !== undefined) {
      Store.setCheckingBalance(checking - amt);
    }
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferNote').value = '';
    document.getElementById('transferFeedback').style.display = 'block';
    document.getElementById('transferFeedback').style.color = 'var(--income)';
    document.getElementById('transferFeedback').textContent = `✅ ${amt.toFixed(2)} € transferidos a la cuenta ahorro`;
    this.render();
  },

  _undoTransfer(id) {
    const t = Store.getTransfers().find(x => x.id === id);
    if (!t) return;
    App.showConfirm('Deshacer transferencia', `¿Deshacer transferencia de ${t.amount.toFixed(2)}€${t.note ? ' (' + t.note + ')' : ''}?`, () => {
      const checking = Store.getCheckingBalance();
      Store.deleteTransfer(id);
      if (checking !== null && checking !== undefined) {
        Store.setCheckingBalance(checking + t.amount);
      }
      Categorias.render();
    });
  },
};
