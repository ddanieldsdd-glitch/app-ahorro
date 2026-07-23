/**
 * ExcelIO — Exportación e importación completa en .xlsx (copia editable)
 * Usa SheetJS (XLSX) desde CDN.
 */
const ExcelIO = {

  export({ months = null } = {}) {
    if (typeof XLSX === 'undefined') {
      App.showToast('⏳ SheetJS aún cargando, inténtalo de nuevo');
      return null;
    }
    try {
      const wb = this.buildWorkbook({ months });
      const stamp = this._stamp();
      return { wb, filename: `presupuesto_${stamp}.xlsx` };
    } catch (err) {
      App.showToast('❌ Error al exportar: ' + err.message, 4000);
      console.error('ExcelIO.export', err);
      return null;
    }
  },

  buildWorkbook({ months = null } = {}) {
    const wb = XLSX.utils.book_new();
    const d = Store.getData();
    const monthSet = months?.length ? new Set(months) : null;
    const inScope = (t) => {
      if (!monthSet) return true;
      const m = t.month || (t.date && t.date.substring(0, 7));
      return monthSet.has(m);
    };

    const txRows = (d.transactions || []).filter(inScope).map(t => this._txRow(t));
    this._appendSheet(wb, 'Movimientos', txRows.length ? txRows : [this._txRow({})], [12,8,18,10,30,14,10,8,8,10,12]);

    const archiveRows = [];
    for (const [month, txs] of Object.entries(d.archives || {})) {
      if (monthSet && !monthSet.has(month)) continue;
      for (const t of txs) if (inScope(t)) archiveRows.push({ Mes: month, ...this._txRow(t) });
    }
    this._appendSheet(wb, 'Archivo', archiveRows.length ? archiveRows : [{ Mes: '' }], [8,12,8,18,10,30,14,10,8,8,10,12]);

    this._appendSheet(wb, 'Deudas', (d.debts || []).map(dbt => ({
      ID: dbt.id || '',
      Persona: dbt.person || '',
      Tipo: dbt.type === 'i_owe' ? 'Yo debo' : 'Me deben',
      Importe: dbt.amount ?? '',
      TotalImporte: dbt.totalAmount ?? '',
      Descripción: dbt.description || '',
      QuéEra: dbt.expensePurpose || dbt.description || '',
      Categoría: dbt.category || '',
      Fecha: dbt.date || '',
      Estado: dbt.isPaid ? 'Pagado' : 'Pendiente',
      FechaPago: dbt.paidDate || '',
      LinkedTxId: dbt.linkedTxId || '',
      AutoTx: dbt.autoCreatedTx ? 'Sí' : 'No',
      SplitCount: dbt.splitCount ?? '',
      SplitAmount: dbt.splitAmount ?? '',
      Partidas: dbt.splitLines?.length ? JSON.stringify(dbt.splitLines) : '',
    })), [12,16,10,10,10,30,28,16,12,10,12,14,8,10,10,40]);

    this._appendSheet(wb, 'Personas', (d.people || []).map(p => (
      typeof p === 'string'
        ? { Nombre: p }
        : { ID: p.id || '', Nombre: p.name || '', Emoji: p.emoji || '', Grupo: p.group || '', Usos: p.count ?? '' }
    )), [12,24,8,16,8]);

    this._appendSheet(wb, 'Metas', (d.savingGoals || []).map(g => ({
      ID: g.id || '',
      Nombre: g.name || '',
      Objetivo: g.targetAmount ?? '',
      Ahorrado: g.currentAmount ?? '',
      FechaObjetivo: g.targetDate || '',
      Prioridad: g.priority ?? '',
      Creado: g.createdAt ? String(g.createdAt).split('T')[0] : '',
    })), [12,20,10,10,14,10,12]);

    this._appendSheet(wb, 'Planificados', (d.plannedExpenses || []).map(p => ({
      ID: p.id || '',
      Nombre: p.name || '',
      Importe: p.amount ?? '',
      Ahorrado: p.savedSoFar ?? 0,
      FechaObjetivo: p.targetDate || '',
      Creado: p.createdAt ? String(p.createdAt).split('T')[0] : '',
    })), [12,24,10,10,14,12]);

    this._appendSheet(wb, 'Recurrentes', (d.recurringTransactions || []).map(r => ({
      ID: r.id || '',
      Nombre: r.name || '',
      Tipo: r.type || '',
      Categoría: r.category || '',
      Importe: r.amount ?? '',
      MétodoPago: r.paymentMethod || '',
      Frecuencia: r.frequency || '',
      DíaMes: r.dayOfMonth ?? '',
      DíaSemana: r.dayOfWeek ?? '',
      ProximaFecha: r.nextDate || '',
      Activo: r.active ? 'Sí' : 'No',
    })), [12,20,8,16,10,14,10,8,10,14,6]);

    this._appendSheet(wb, 'Transferencias', (d.transfers || []).map(t => ({
      ID: t.id || '',
      Fecha: t.date || '',
      Importe: t.amount ?? '',
      Desde: t.from || t.fromAccount || '',
      Hacia: t.to || t.toAccount || '',
      Descripción: t.description || '',
    })), [12,12,10,12,12,30]);

    this._appendSheet(wb, 'Saldos', [
      { Cuenta: 'Corriente', Saldo: d.checkingBalance ?? 0, Notas: 'Banco / tarjeta' },
      { Cuenta: 'Ahorro', Saldo: d.savingsBalance || 0, Notas: 'Hucha / cuenta ahorro' },
      { Cuenta: 'Efectivo', Saldo: d.cashBalance || 0, Notas: 'Dinero en mano' },
      { Cuenta: 'Base Corriente', Saldo: d.checkingBaseBalance || 0, Notas: 'Balance inicial' },
      { Cuenta: 'Imprevistos', Saldo: d.imprevistosSavings || 0, Notas: 'Reserva imprevistos' },
      { Cuenta: 'Redondeos', Saldo: d.totalRoundUpSavings || 0, Notas: 'Acumulado redondeos' },
      { Cuenta: 'Inicial Corriente', Saldo: d.initialCheckingBalance || 0, Notas: '' },
      { Cuenta: 'Inicial Ahorro', Saldo: d.initialSavingsBalance || 0, Notas: '' },
    ], [18,12,24]);

    const join = (arr) => (arr || []).join(' | ');
    this._appendSheet(wb, 'Config', [
      { Clave: 'Categorías gasto', Valor: join(d.categories) },
      { Clave: 'Categorías ingreso', Valor: join(d.incomeCategories) },
      { Clave: 'Métodos de pago', Valor: join(d.paymentMethods) },
      { Clave: 'Tipos', Valor: join(d.types) },
      { Clave: 'Alimentación categorías', Valor: join(d.foodCategories) },
      { Clave: 'Presupuesto semanal (€)', Valor: d.budgetConfig?.weeklyIncome ?? '' },
      { Clave: 'Extra mensual (€)', Valor: d.budgetConfig?.monthlyExtra ?? '' },
      { Clave: 'Límites categoría (JSON)', Valor: JSON.stringify(d.budgetConfig?.categoryLimits || {}) },
      { Clave: 'Presupuesto alimentación (€)', Valor: d.foodBudget ?? '' },
      { Clave: 'Presupuesto imprevistos (€)', Valor: d.imprevistosBudget ?? '' },
      { Clave: 'Día de ahorro semanal', Valor: d.savingsDay ?? '' },
      { Clave: 'Round-up activo', Valor: d.roundUpEnabled ? 'Sí' : 'No' },
      { Clave: 'Round-up meta ID', Valor: d.roundUpGoalId || '' },
      { Clave: 'Mes actual', Valor: d.currentMonth ?? '' },
      { Clave: 'Exportado', Valor: new Date().toISOString() },
      { Clave: 'Meses exportados', Valor: months?.length ? months.join(', ') : 'Todos' },
    ], [28, 50]);

    this._appendSheet(wb, 'Grupos', [
      ...(d.categoryGroups || []).map(g => ({ Tipo: 'Categoría', ID: g.id || '', Nombre: g.name || '', Miembros: join(g.members) })),
      ...(d.incomeGroups || []).map(g => ({ Tipo: 'Ingreso', ID: g.id || '', Nombre: g.name || '', Miembros: join(g.members) })),
      ...(d.peopleGroups || []).map(g => ({ Tipo: 'Personas', ID: g.id || '', Nombre: g.name || '', Miembros: join(g.members) })),
    ], [12,12,20,40]);

    return wb;
  },

  workbookToArrayBuffer(wb) {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  },

  parseArrayBuffer(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    return this.parseWorkbook(wb);
  },

  parseWorkbook(wb) {
    const txSheet = wb.Sheets['Movimientos'];
    if (!txSheet) throw new Error('No se encontró la hoja "Movimientos"');

    const txRows = XLSX.utils.sheet_to_json(txSheet, { defval: '' });
    const archRows = wb.Sheets['Archivo'] ? XLSX.utils.sheet_to_json(wb.Sheets['Archivo'], { defval: '' }) : [];

    const transactions = txRows.map(r => this._mapRow(r)).filter(Boolean);
    const archives = {};
    for (const r of archRows) {
      const t = this._mapRow(r);
      if (!t) continue;
      const month = r.Mes || r.mes || t.month;
      if (!archives[month]) archives[month] = [];
      archives[month].push(t);
    }

    const payload = {
      transactions,
      archives,
      currentMonth: this._cfgVal(wb, 'Mes actual') || null,
      debts: this._parseDebts(wb),
      people: this._parsePeople(wb),
      savingGoals: this._parseGoals(wb),
      plannedExpenses: this._parsePlanned(wb),
      recurringTransactions: this._parseRecurring(wb),
      transfers: this._parseTransfers(wb),
      ...this._parseSaldos(wb),
      ...this._parseConfig(wb),
      ...this._parseGrupos(wb),
    };

    return {
      payload,
      availableMonths: Store.getMonthsFromPayload(payload),
      txCount: transactions.length + Object.values(archives).reduce((n, a) => n + a.length, 0),
    };
  },

  async applyImport(parsed, { months, strategy, mergeGlobal = true } = {}) {
    const { payload } = parsed;
    const selectedMonths = months?.length ? months : Store.getMonthsFromPayload(payload);
    const incoming = Store.collectIncomingTransactions(payload, selectedMonths);
    const stats = Store.importTransactionSubset(incoming, selectedMonths, strategy || 'merge');
    if (mergeGlobal) Store.mergeGlobalPayload(payload);
    await Store._save({ awaitSync: true, forcePush: true });
    return stats;
  },

  _appendSheet(wb, name, rows, widths) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    if (widths) sheet['!cols'] = widths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, sheet, name);
  },

  _stamp() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  },

  _txRow(t) {
    return {
      Fecha: t.date || '',
      Tipo: t.type || '',
      Categoría: t.category || '',
      Importe: t.amount ?? '',
      Descripción: t.description || '',
      MétodoPago: t.paymentMethod || '',
      Cuenta: t.account || '',
      Mes: t.month || '',
      Emoji: t.emoji || '',
      GroupId: t.groupId || '',
      ID: t.id || '',
    };
  },

  _mapRow(r) {
    const rawDate = r.Fecha || r.fecha || '';
    const rawAmount = r.Importe || r.importe || r.amount || '';
    const amount = parseFloat(String(rawAmount).replace(',', '.'));
    if (!rawDate || isNaN(amount) || amount <= 0) return null;

    const dateStr = rawDate instanceof Date
      ? rawDate.toISOString().split('T')[0]
      : this._parseDate(String(rawDate));
    if (!dateStr) return null;

    return {
      id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
      date: dateStr,
      month: r.Mes || r.mes || dateStr.substring(0, 7),
      type: r.Tipo || r.tipo || 'Gasto',
      category: r.Categoría || r.categoria || r.category || 'Otros',
      amount,
      description: r.Descripción || r.descripcion || r.description || '',
      paymentMethod: r.MétodoPago || r.metodopago || r.paymentMethod || '',
      account: r.Cuenta || r.cuenta || r.account || 'checking',
      emoji: r.Emoji || r.emoji || '',
      groupId: r.GroupId || r.groupId || '',
    };
  },

  _parseDate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  },

  _sheetRows(wb, name) {
    const sh = wb.Sheets[name];
    return sh ? XLSX.utils.sheet_to_json(sh, { defval: '' }) : [];
  },

  _cfgVal(wb, key) {
    const row = this._sheetRows(wb, 'Config').find(r => (r.Clave || r.clave) === key);
    return row ? (row.Valor ?? row.valor ?? '') : '';
  },

  _splitList(val) {
    if (!val) return [];
    return String(val).split('|').map(s => s.trim()).filter(Boolean);
  },

  _parseDebts(wb) {
    return this._sheetRows(wb, 'Deudas').map(r => {
      const amount = parseFloat(String(r.Importe || r.importe).replace(',', '.'));
      if (!r.Persona && !amount) return null;
      const tipo = String(r.Tipo || '').toLowerCase();
      let splitLines = null;
      const partidasRaw = r.Partidas || r.partidas || '';
      if (partidasRaw) {
        try { splitLines = JSON.parse(String(partidasRaw)); } catch { splitLines = null; }
      }
      const desc = r.Descripción || r.descripcion || '';
      const purpose = r['QuéEra'] || r.QueEra || r.quéEra || r.concepto || desc;
      return {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        person: r.Persona || r.persona || '',
        type: tipo.includes('debo') ? 'i_owe' : 'owed_to_me',
        amount: isNaN(amount) ? 0 : amount,
        totalAmount: parseFloat(String(r.TotalImporte || amount).replace(',', '.')) || amount,
        description: desc,
        expensePurpose: purpose,
        category: r.Categoría || r.categoria || 'Otros',
        date: this._parseDate(String(r.Fecha || '')) || new Date().toISOString().split('T')[0],
        isPaid: String(r.Estado || '').toLowerCase().includes('pag'),
        paidDate: this._parseDate(String(r.FechaPago || '')) || null,
        linkedTxId: r.LinkedTxId || r.linkedTxId || null,
        autoCreatedTx: String(r.AutoTx || '').toLowerCase().startsWith('s'),
        splitCount: r.SplitCount ? parseInt(r.SplitCount, 10) : undefined,
        splitAmount: r.SplitAmount ? parseFloat(String(r.SplitAmount).replace(',', '.')) : undefined,
        splitLines,
      };
    }).filter(Boolean);
  },

  _parsePeople(wb) {
    return this._sheetRows(wb, 'Personas').map(r => {
      const name = String(r.Nombre || r.nombre || '').trim();
      return name || null;
    }).filter(Boolean);
  },

  _parseGoals(wb) {
    return this._sheetRows(wb, 'Metas').map(r => {
      const target = parseFloat(String(r.Objetivo || r.objetivo).replace(',', '.'));
      if (!r.Nombre && isNaN(target)) return null;
      return {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        name: r.Nombre || r.nombre || '',
        targetAmount: isNaN(target) ? 0 : target,
        currentAmount: parseFloat(String(r.Ahorrado || 0).replace(',', '.')) || 0,
        targetDate: r.FechaObjetivo || '',
        priority: r.Prioridad !== '' ? parseInt(r.Prioridad, 10) : 0,
        createdAt: r.Creado ? new Date(r.Creado).toISOString() : new Date().toISOString(),
      };
    }).filter(Boolean);
  },

  _parsePlanned(wb) {
    return this._sheetRows(wb, 'Planificados').map(r => {
      const amount = parseFloat(String(r.Importe || 0).replace(',', '.'));
      if (!r.Nombre && isNaN(amount)) return null;
      return {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        name: r.Nombre || r.nombre || '',
        amount: isNaN(amount) ? 0 : amount,
        savedSoFar: parseFloat(String(r.Ahorrado || 0).replace(',', '.')) || 0,
        targetDate: r.FechaObjetivo || '',
        createdAt: r.Creado ? new Date(r.Creado).toISOString() : new Date().toISOString(),
      };
    }).filter(Boolean);
  },

  _parseRecurring(wb) {
    return this._sheetRows(wb, 'Recurrentes').map(r => {
      const amount = parseFloat(String(r.Importe || 0).replace(',', '.'));
      if (!r.Nombre && isNaN(amount)) return null;
      return {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        name: r.Nombre || r.nombre || '',
        type: r.Tipo || 'Gasto',
        category: r.Categoría || r.categoria || 'Otros',
        amount: isNaN(amount) ? 0 : amount,
        paymentMethod: r.MétodoPago || r.metodopago || 'Tarjeta',
        frequency: r.Frecuencia || 'monthly',
        dayOfMonth: r.DíaMes !== '' ? parseInt(r.DíaMes, 10) : undefined,
        dayOfWeek: r.DíaSemana !== '' ? parseInt(r.DíaSemana, 10) : undefined,
        nextDate: this._parseDate(String(r.ProximaFecha || '')) || new Date().toISOString().split('T')[0],
        active: !String(r.Activo || 'Sí').toLowerCase().startsWith('n'),
        createdAt: new Date().toISOString(),
      };
    }).filter(Boolean);
  },

  _parseTransfers(wb) {
    return this._sheetRows(wb, 'Transferencias').map(r => {
      const amount = parseFloat(String(r.Importe || 0).replace(',', '.'));
      if (!r.Fecha && isNaN(amount)) return null;
      return {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        date: this._parseDate(String(r.Fecha || '')) || new Date().toISOString().split('T')[0],
        amount: isNaN(amount) ? 0 : amount,
        from: r.Desde || r.desde || '',
        to: r.Hacia || r.hacia || '',
        description: r.Descripción || r.descripcion || '',
      };
    }).filter(Boolean);
  },

  _parseSaldos(wb) {
    const map = {};
    for (const r of this._sheetRows(wb, 'Saldos')) {
      map[r.Cuenta || r.cuenta] = parseFloat(String(r.Saldo ?? r.saldo).replace(',', '.')) || 0;
    }
    const out = {};
    if ('Corriente' in map) out.checkingBalance = map.Corriente;
    if ('Ahorro' in map) out.savingsBalance = map.Ahorro;
    if ('Efectivo' in map) out.cashBalance = map.Efectivo;
    if ('Base Corriente' in map) out.checkingBaseBalance = map['Base Corriente'];
    if ('Imprevistos' in map) out.imprevistosSavings = map.Imprevistos;
    if ('Redondeos' in map) out.totalRoundUpSavings = map.Redondeos;
    if ('Inicial Corriente' in map) out.initialCheckingBalance = map['Inicial Corriente'];
    if ('Inicial Ahorro' in map) out.initialSavingsBalance = map['Inicial Ahorro'];
    return out;
  },

  _parseConfig(wb) {
    const cfg = {};
    const weekly = this._cfgVal(wb, 'Presupuesto semanal (€)');
    const extra = this._cfgVal(wb, 'Extra mensual (€)');
    if (weekly !== '') cfg.budgetConfig = { weeklyIncome: parseFloat(weekly) || 0, monthlyExtra: parseFloat(extra) || 0, categoryLimits: {} };
    const limitsRaw = this._cfgVal(wb, 'Límites categoría (JSON)');
    if (limitsRaw) {
      try { cfg.budgetConfig = { ...(cfg.budgetConfig || {}), categoryLimits: JSON.parse(limitsRaw) }; } catch {}
    }
    cfg.categories = this._splitList(this._cfgVal(wb, 'Categorías gasto'));
    cfg.incomeCategories = this._splitList(this._cfgVal(wb, 'Categorías ingreso'));
    cfg.paymentMethods = this._splitList(this._cfgVal(wb, 'Métodos de pago'));
    cfg.types = this._splitList(this._cfgVal(wb, 'Tipos'));
    cfg.foodCategories = this._splitList(this._cfgVal(wb, 'Alimentación categorías'));
    const food = this._cfgVal(wb, 'Presupuesto alimentación (€)');
    if (food !== '') cfg.foodBudget = parseFloat(food) || 0;
    const imp = this._cfgVal(wb, 'Presupuesto imprevistos (€)');
    if (imp !== '') cfg.imprevistosBudget = parseFloat(imp) || 0;
    const sd = this._cfgVal(wb, 'Día de ahorro semanal');
    if (sd !== '') cfg.savingsDay = parseInt(sd, 10) || 1;
    cfg.roundUpEnabled = this._cfgVal(wb, 'Round-up activo').toLowerCase().startsWith('s');
    cfg.roundUpGoalId = this._cfgVal(wb, 'Round-up meta ID') || null;
    const cm = this._cfgVal(wb, 'Mes actual');
    if (cm) cfg.currentMonth = cm;
    return cfg;
  },

  _parseGrupos(wb) {
    const categoryGroups = [], incomeGroups = [], peopleGroups = [];
    for (const r of this._sheetRows(wb, 'Grupos')) {
      const tipo = r.Tipo || r.tipo || '';
      const item = {
        id: r.ID || r.id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
        name: r.Nombre || r.nombre || '',
        members: this._splitList(r.Miembros || r.miembros || ''),
      };
      if (tipo.toLowerCase().includes('ingreso')) incomeGroups.push(item);
      else if (tipo.toLowerCase().includes('person')) peopleGroups.push(item);
      else categoryGroups.push(item);
    }
    return { categoryGroups, incomeGroups, peopleGroups };
  },

  // Legacy entry points
  importFromInput(input) {
    BackupIO._openViaInput(input, 'excel');
  },
};
