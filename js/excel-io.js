/**
 * ExcelIO — Exportación e importación de datos en formato .xlsx
 * Usa SheetJS (XLSX) cargado desde CDN.
 * Hojas: Movimientos, Archivo, Deudas, Metas, Planificados, Recurrentes, Saldos, Config
 */
const ExcelIO = {

  // ── Exportar ──────────────────────────────────────────────────────────────

  export() {
    if (typeof XLSX === 'undefined') {
      App.showToast('⏳ SheetJS aún cargando, inténtalo de nuevo en un momento');
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      const d  = Store.getData();

      // ── Movimientos actuales ───────────────────────────────────────────────
      const txRows = (d.transactions || []).map(t => this._txRow(t));
      const txSheet = XLSX.utils.json_to_sheet(txRows.length ? txRows : [this._txRow({})]);
      this._setColWidths(txSheet, [12,8,18,10,30,14,10,8,12]);
      XLSX.utils.book_append_sheet(wb, txSheet, 'Movimientos');

      // ── Archivo (meses anteriores) ─────────────────────────────────────────
      const archiveRows = [];
      for (const [month, txs] of Object.entries(d.archives || {})) {
        for (const t of txs) archiveRows.push({ Mes: month, ...this._txRow(t) });
      }
      const archSheet = XLSX.utils.json_to_sheet(archiveRows.length ? archiveRows : [{ Mes: '' }]);
      this._setColWidths(archSheet, [8,12,8,18,10,30,14,10,8,12]);
      XLSX.utils.book_append_sheet(wb, archSheet, 'Archivo');

      // ── Deudas ──────────────────────────────────────────────────────────────
      const debtRows = (d.debts || []).map(dbt => ({
        Persona: dbt.person || '',
        Tipo: dbt.type === 'i_owe' ? 'Yo debo' : 'Me deben',
        Importe: dbt.amount,
        Descripción: dbt.description || '',
        Categoría: dbt.category || '',
        Fecha: dbt.date || '',
        Estado: dbt.isPaid ? 'Pagado' : 'Pendiente',
        FechaPago: dbt.paidDate || '',
      }));
      const debtSheet = XLSX.utils.json_to_sheet(debtRows.length ? debtRows : [{}]);
      this._setColWidths(debtSheet, [16,10,10,30,16,12,10,12]);
      XLSX.utils.book_append_sheet(wb, debtSheet, 'Deudas');

      // ── Metas de ahorro ──────────────────────────────────────────────────────
      const goalRows = (d.savingGoals || []).map(g => ({
        Nombre: g.name || '',
        Objetivo: g.targetAmount,
        Ahorrado: g.currentAmount,
        Restante: Math.max(0, g.targetAmount - g.currentAmount),
        FechaObjetivo: g.targetDate || '',
        Prioridad: g.priority ?? '',
        Creado: g.createdAt ? g.createdAt.split('T')[0] : '',
      }));
      const goalSheet = XLSX.utils.json_to_sheet(goalRows.length ? goalRows : [{}]);
      this._setColWidths(goalSheet, [20,10,10,10,14,10,12]);
      XLSX.utils.book_append_sheet(wb, goalSheet, 'Metas');

      // ── Gastos planificados ──────────────────────────────────────────────────
      const peRows = (d.plannedExpenses || []).map(p => ({
        Nombre: p.name || '',
        Importe: p.amount,
        Ahorrado: p.savedSoFar || 0,
        FechaObjetivo: p.targetDate || '',
        Creado: p.createdAt ? p.createdAt.split('T')[0] : '',
      }));
      const peSheet = XLSX.utils.json_to_sheet(peRows.length ? peRows : [{}]);
      this._setColWidths(peSheet, [24,10,10,14,12]);
      XLSX.utils.book_append_sheet(wb, peSheet, 'Planificados');

      // ── Transacciones recurrentes ─────────────────────────────────────────────
      const recRows = (d.recurringTransactions || []).map(r => ({
        Nombre: r.name || '',
        Tipo: r.type || '',
        Categoría: r.category || '',
        Importe: r.amount,
        Frecuencia: r.frequency || '',
        DíaMes: r.dayOfMonth ?? '',
        DíaSemana: r.dayOfWeek ?? '',
        ProximaFecha: r.nextDate || '',
        Activo: r.active ? 'Sí' : 'No',
      }));
      const recSheet = XLSX.utils.json_to_sheet(recRows.length ? recRows : [{}]);
      this._setColWidths(recSheet, [20,8,16,10,10,8,10,14,6]);
      XLSX.utils.book_append_sheet(wb, recSheet, 'Recurrentes');

      // ── Saldos ─────────────────────────────────────────────────────────────
      const saldoRows = [
        { Cuenta: 'Corriente',    Saldo: d.checkingBalance ?? 0,    Notas: 'Banco / tarjeta' },
        { Cuenta: 'Ahorro',       Saldo: d.savingsBalance  || 0,    Notas: 'Hucha / cuenta ahorro' },
        { Cuenta: 'Efectivo',     Saldo: d.cashBalance     || 0,    Notas: 'Dinero en mano' },
        { Cuenta: 'Base Corriente', Saldo: d.checkingBaseBalance || 0, Notas: 'Balance inicial' },
        { Cuenta: 'Imprevistos',  Saldo: d.imprevistosSavings || 0, Notas: 'Reserva imprevistos' },
        { Cuenta: 'Redondeos',    Saldo: d.totalRoundUpSavings || 0, Notas: 'Acumulado redondeos' },
      ];
      const saldoSheet = XLSX.utils.json_to_sheet(saldoRows);
      this._setColWidths(saldoSheet, [18,12,24]);
      XLSX.utils.book_append_sheet(wb, saldoSheet, 'Saldos');

      // ── Configuración ──────────────────────────────────────────────────────
      const cfgRows = [
        { Clave: 'Categorías gasto', Valor: (d.categories || []).join(', ') },
        { Clave: 'Categorías ingreso', Valor: (d.incomeCategories || []).join(', ') },
        { Clave: 'Métodos de pago', Valor: (d.paymentMethods || []).join(', ') },
        { Clave: 'Presupuesto semanal (€)', Valor: d.budgetConfig?.weeklyIncome ?? '' },
        { Clave: 'Extra mensual (€)', Valor: d.budgetConfig?.monthlyExtra ?? '' },
        { Clave: 'Presupuesto alimentación (€)', Valor: d.foodBudget ?? '' },
        { Clave: 'Presupuesto imprevistos (€)', Valor: d.imprevistosBudget ?? '' },
        { Clave: 'Día de ahorro semanal', Valor: d.savingsDay ?? '' },
        { Clave: 'Round-up activo', Valor: d.roundUpEnabled ? 'Sí' : 'No' },
        { Clave: 'Mes actual', Valor: d.currentMonth ?? '' },
        { Clave: 'Exportado', Valor: new Date().toISOString() },
      ];
      const cfgSheet = XLSX.utils.json_to_sheet(cfgRows);
      this._setColWidths(cfgSheet, [28, 40]);
      XLSX.utils.book_append_sheet(wb, cfgSheet, 'Config');

      // ── Guardar ────────────────────────────────────────────────────────────
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      XLSX.writeFile(wb, `presupuesto_${stamp}.xlsx`);
      App.showToast('✅ Excel exportado correctamente');
    } catch (err) {
      App.showToast('❌ Error al exportar: ' + err.message, 4000);
      console.error('ExcelIO.export error', err);
    }
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
      ID: t.id || '',
    };
  },

  _setColWidths(sheet, widths) {
    sheet['!cols'] = widths.map(w => ({ wch: w }));
  },

  // ── Importar ──────────────────────────────────────────────────────────────

  importFromInput(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      App.showToast('⏳ SheetJS aún cargando, inténtalo de nuevo');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => this._processImport(e.target.result);
    reader.readAsArrayBuffer(file);
  },

  _processImport(arrayBuffer) {
    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

      const txSheet = wb.Sheets['Movimientos'];
      const archSheet = wb.Sheets['Archivo'];
      if (!txSheet) {
        App.showToast('❌ No se encontró la hoja "Movimientos"', 4000);
        return;
      }

      const txRows = XLSX.utils.sheet_to_json(txSheet, { defval: '' });
      const archRows = archSheet ? XLSX.utils.sheet_to_json(archSheet, { defval: '' }) : [];

      const txMapped   = txRows.map(r => this._mapRow(r)).filter(Boolean);
      const archMapped = archRows.map(r => this._mapRow(r)).filter(Boolean);
      const totalTx    = txMapped.length + archMapped.length;

      if (totalTx === 0) {
        App.showToast('⚠️ No se encontraron movimientos válidos en el Excel', 4000);
        return;
      }

      App.openModal({
        title: '📊 Importar Excel',
        body: `<p style="font-size:13px;color:var(--text);line-height:1.6">
          Se importarán <strong>${txMapped.length}</strong> movimiento${txMapped.length !== 1 ? 's' : ''} actuales
          ${archMapped.length > 0 ? `y <strong>${archMapped.length}</strong> archivados` : ''}.
        </p>
        <div style="font-size:12px;color:var(--text-secondary);padding:10px;background:var(--bg);border-radius:8px;margin-top:8px;line-height:1.5">
          ⚠️ Los movimientos existentes con el mismo ID se actualizarán; los nuevos se añadirán.
          Los datos no relacionados con movimientos no se modifican.
        </div>`,
        actions: [
          { label: 'Cancelar' },
          { label: `Importar ${totalTx}`, primary: true, cb: () => this._doImport(txMapped, archMapped) },
        ],
      });
    } catch (err) {
      App.showToast('❌ Error al leer el Excel: ' + err.message, 4000);
      console.error('ExcelIO._processImport error', err);
    }
  },

  _mapRow(r) {
    const rawDate = r['Fecha'] || r['fecha'] || '';
    const rawAmount = r['Importe'] || r['importe'] || r['amount'] || '';
    const amount = parseFloat(String(rawAmount).replace(',', '.'));
    if (!rawDate || isNaN(amount) || amount <= 0) return null;

    const dateStr = rawDate instanceof Date
      ? rawDate.toISOString().split('T')[0]
      : this._parseDate(String(rawDate));
    if (!dateStr) return null;

    const type = r['Tipo'] || r['tipo'] || 'Gasto';
    const category = r['Categoría'] || r['categoria'] || r['category'] || 'Otros';
    return {
      id: r['ID'] || r['id'] || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
      date: dateStr,
      month: dateStr.substring(0, 7),
      type,
      category,
      amount,
      description: r['Descripción'] || r['descripcion'] || r['description'] || '',
      paymentMethod: r['MétodoPago'] || r['metodopago'] || r['paymentMethod'] || '',
      account: r['Cuenta'] || r['cuenta'] || r['account'] || 'checking',
    };
  },

  _parseDate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // dd/mm/yyyy or dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  },

  _doImport(txMapped, archMapped) {
    Store._backup('pre-excel-import');
    const d = Store.getData();
    const existingIds = new Set(d.transactions.map(t => t.id));

    let addedTx = 0, updatedTx = 0;
    for (const t of txMapped) {
      if (existingIds.has(t.id)) {
        Store.updateTransaction(t.id, t);
        updatedTx++;
      } else {
        d.transactions.push(t);
        addedTx++;
      }
    }

    for (const t of archMapped) {
      const month = t.month || t.date.substring(0, 7);
      if (!d.archives[month]) d.archives[month] = [];
      const archIds = new Set(d.archives[month].map(x => x.id));
      if (!archIds.has(t.id)) d.archives[month].push(t);
    }

    Store._save();
    App._renderMonthSelector();
    App._refreshAll();
    App.showToast(`✅ Importados: +${addedTx} nuevos, ${updatedTx} actualizados${archMapped.length > 0 ? `, ${archMapped.length} archivados` : ''}`);
  },
};
