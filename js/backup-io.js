/**
 * BackupIO — Export/import JSON y Excel con selector de archivo,
 * filtro por meses/años y resolución de conflictos.
 */
const BackupIO = {

  _pendingImport: null,

  async exportFlow(format = null) {
    this._showExportModal(format);
  },

  async importFlow(format = null) {
    const accept = format === 'json' ? '.json,application/json' : format === 'excel' ? '.xlsx' : '.json,.xlsx,application/json';
    const file = await FileIO.openFile(accept);
    if (!file) return;

    try {
      if (file.name.endsWith('.json') || file.type === 'application/json') {
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload.transactions) throw new Error('JSON de backup inválido');
        this._pendingImport = { type: 'json', payload, raw: text, filename: file.name };
      } else {
        if (typeof XLSX === 'undefined') {
          App.showToast('⏳ SheetJS aún cargando');
          return;
        }
        const buf = await file.arrayBuffer();
        const parsed = ExcelIO.parseArrayBuffer(buf);
        this._pendingImport = { type: 'excel', parsed, filename: file.name };
      }
      this._showScopeModal('import');
    } catch (err) {
      App.showToast('❌ ' + err.message, 4000);
    }
  },

  _openViaInput(input, type) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    (async () => {
      try {
        if (type === 'json' || file.name.endsWith('.json')) {
          const text = await file.text();
          const payload = JSON.parse(text);
          this._pendingImport = { type: 'json', payload, raw: text, filename: file.name };
        } else {
          const buf = await file.arrayBuffer();
          const parsed = ExcelIO.parseArrayBuffer(buf);
          this._pendingImport = { type: 'excel', parsed, filename: file.name };
        }
        this._showScopeModal('import');
      } catch (err) {
        App.showToast('❌ ' + err.message, 4000);
      }
    })();
  },

  _showExportModal(presetFormat) {
    const months = Store.getAvailableMonths();
    const years = this._groupByYear(months);
    const monthHtml = this._monthPickerHtml('exportMonths', months, years, true);

    App.openModal({
      title: '⬇ Exportar backup',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:12px;line-height:1.5">
          Elige formato y qué meses incluir. Se abrirá el selector de archivo de tu dispositivo para guardar.
        </p>
        <div class="form-group" style="margin-bottom:10px">
          <label style="font-size:12px;font-weight:600">Formato</label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <button type="button" class="cal-type-btn${presetFormat !== 'excel' ? ' active' : ''}" id="exportFmtJson" onclick="BackupIO._setExportFormat('json')">JSON (copia exacta)</button>
            <button type="button" class="cal-type-btn${presetFormat === 'excel' ? ' active' : ''}" id="exportFmtExcel" onclick="BackupIO._setExportFormat('excel')">Excel (editable)</button>
          </div>
        </div>
        <div class="form-group">
          <label style="font-size:12px;font-weight:600">Meses a exportar</label>
          ${monthHtml}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;line-height:1.5">
          JSON incluye siempre categorías, saldos y configuración. Excel añade hojas legibles (Deudas, Metas, etc.).
        </div>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Guardar archivo…', primary: true, cb: () => this._doExport(presetFormat || 'json') },
      ],
    });
    this._exportFormat = presetFormat || 'json';
  },

  _setExportFormat(fmt) {
    this._exportFormat = fmt;
    document.getElementById('exportFmtJson')?.classList.toggle('active', fmt === 'json');
    document.getElementById('exportFmtExcel')?.classList.toggle('active', fmt === 'excel');
  },

  async _doExport(format) {
    const fmt = format || this._exportFormat || 'json';
    const months = this._readSelectedMonths('exportMonths');
    const allMonths = Store.getAvailableMonths();
    const scope = months.length === allMonths.length ? null : months;

    try {
      if (fmt === 'excel') {
        if (typeof XLSX === 'undefined') {
          App.showToast('⏳ SheetJS aún cargando');
          return;
        }
        const built = ExcelIO.export({ months: scope });
        if (!built) return;
        const buf = ExcelIO.workbookToArrayBuffer(built.wb);
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const ok = await FileIO.saveBlob(blob, built.filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        if (ok) App.showToast('✅ Excel guardado');
      } else {
        const json = Store.exportJSON({ months: scope });
        const blob = new Blob([json], { type: 'application/json' });
        const stamp = new Date().toISOString().split('T')[0];
        const ok = await FileIO.saveBlob(blob, `presupuesto_${stamp}.json`, 'application/json');
        if (ok) App.showToast('✅ Backup JSON guardado');
      }
    } catch (err) {
      App.showToast('❌ ' + err.message, 4000);
    }
  },

  _showScopeModal(mode) {
    const imp = this._pendingImport;
    if (!imp) return;

    const available = imp.type === 'json'
      ? Store.getMonthsFromPayload(imp.payload)
      : imp.parsed.availableMonths;
    const years = this._groupByYear(available);
    const monthHtml = this._monthPickerHtml('importMonths', available, years, true);

    App.openModal({
      title: '📥 Importar — elegir meses',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:10px;line-height:1.5">
          Archivo: <strong>${esc(imp.filename)}</strong><br>
          ${imp.type === 'excel' ? `${imp.parsed.txCount} movimientos detectados` : `${(imp.payload.transactions || []).length} movimientos en JSON`}
        </p>
        <div class="form-group">
          <label style="font-size:12px;font-weight:600">Meses a importar</label>
          ${monthHtml}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;line-height:1.5">
          Deudas, metas, saldos y configuración del Excel se fusionan por ID (no dependen del mes).
        </div>`,
      actions: [
        { label: 'Cancelar', cb: () => { this._pendingImport = null; } },
        { label: 'Continuar', primary: true, cb: () => this._checkConflicts() },
      ],
    });
  },

  _checkConflicts() {
    const imp = this._pendingImport;
    if (!imp) return;

    const months = this._readSelectedMonths('importMonths');
    if (!months.length) {
      App.showToast('⚠️ Selecciona al menos un mes');
      return;
    }

    const payload = imp.type === 'json' ? imp.payload : imp.parsed.payload;
    const analysis = Store.analyzeImportOverlap(payload, months);

    if (!analysis.hasConflict) {
      this._runImport(months, 'merge');
      return;
    }

    const monthLabels = analysis.overlapMonths.map(m => this._formatMonth(m)).join(', ');
    App.openModal({
      title: '⚠️ Datos solapados',
      body: `
        <p style="font-size:13px;color:var(--text);line-height:1.6;margin-bottom:10px">
          Los meses <strong>${esc(monthLabels)}</strong> ya tienen datos en la app
          (${analysis.incomingCount} movimientos en el archivo, ${analysis.duplicateIds} IDs repetidos).
        </p>
        <p style="font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:12px">
          Elige cómo continuar:
        </p>
        <ul style="font-size:12px;color:var(--text);line-height:1.7;margin:0 0 0 18px;padding:0">
          <li><strong>Sustituir</strong> — borra los meses locales y pone los del archivo</li>
          <li><strong>Conservar</strong> — mantiene lo tuyo; solo importa meses nuevos</li>
          <li><strong>Fusionar</strong> — mismo ID actualiza; IDs nuevos se añaden</li>
        </ul>`,
      actions: [
        { label: 'Cancelar', cb: () => { this._pendingImport = null; } },
        { label: 'Conservar lo mío', cb: () => this._runImport(months, 'keep') },
        { label: 'Fusionar', cb: () => this._runImport(months, 'merge') },
        { label: 'Sustituir', primary: true, cb: () => this._runImport(months, 'replace') },
      ],
    });
  },

  async _runImport(months, strategy) {
    const imp = this._pendingImport;
    if (!imp) return;

    try {
      let stats;
      if (imp.type === 'json') {
        stats = await Store.importJSON(imp.raw, { months, strategy, mergeGlobal: true });
      } else {
        stats = await ExcelIO.applyImport(imp.parsed, { months, strategy, mergeGlobal: true });
      }

      this._pendingImport = null;
      App._renderMonthSelector();
      App._refreshAll();

      const synced = Store.getSyncStatus() === 'synced';
      if (stats.full) {
        App.showToast(synced ? '✅ Backup restaurado y sincronizado con la nube' : '✅ Backup completo restaurado (revisa conexión a la nube)', synced ? 3500 : 4500);
      } else {
        App.showToast(`✅ Importado: +${stats.added} nuevos, ${stats.updated} actualizados${stats.skipped ? `, ${stats.skipped} omitidos` : ''}${synced ? '' : ' — sin conexión a la nube'}`, synced ? 3500 : 4500);
      }
    } catch (err) {
      App.showToast('❌ ' + err.message, 4000);
    }
  },

  _groupByYear(months) {
    const map = {};
    for (const m of months) {
      const y = m.split('-')[0];
      if (!map[y]) map[y] = [];
      map[y].push(m);
    }
    return map;
  },

  _formatMonth(ym) {
    const [y, mo] = ym.split('-').map(Number);
    return `${MONTHS[mo - 1]} ${y}`;
  },

  _monthPickerHtml(prefix, months, years, allChecked) {
    if (!months.length) {
      return '<div style="font-size:12px;color:var(--text-secondary)">No hay meses disponibles</div>';
    }
    const yearKeys = Object.keys(years).sort().reverse();
    let html = `
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin:8px 0 10px;cursor:pointer">
        <input type="checkbox" id="${prefix}_all" ${allChecked ? 'checked' : ''}
          onchange="BackupIO._toggleAllMonths('${prefix}', this.checked)">
        <strong>Todos los meses (${months.length})</strong>
      </label>`;

    for (const y of yearKeys) {
      const list = years[y];
      html += `
        <div style="margin-bottom:8px;padding:8px;background:var(--bg);border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;margin-bottom:6px;cursor:pointer">
            <input type="checkbox" class="${prefix}_year" data-year="${y}" checked
              onchange="BackupIO._toggleYear('${prefix}', '${y}', this.checked)">
            ${y} (${list.length})
          </label>
          <div style="display:flex;flex-wrap:wrap;gap:6px 12px;padding-left:4px">`;
      for (const m of list) {
        const mo = parseInt(m.split('-')[1], 10);
        html += `
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer">
              <input type="checkbox" class="${prefix}_month" data-month="${m}" data-year="${y}" checked>
              ${MONTHS[mo - 1]}
            </label>`;
      }
      html += '</div></div>';
    }
    return html;
  },

  _readSelectedMonths(prefix) {
    const all = document.getElementById(`${prefix}_all`);
    if (all?.checked) {
      return [...document.querySelectorAll(`.${prefix}_month`)].map(el => el.dataset.month);
    }
    return [...document.querySelectorAll(`.${prefix}_month:checked`)].map(el => el.dataset.month);
  },

  _toggleAllMonths(prefix, checked) {
    document.querySelectorAll(`.${prefix}_month, .${prefix}_year`).forEach(el => { el.checked = checked; });
  },

  _toggleYear(prefix, year, checked) {
    document.querySelectorAll(`.${prefix}_month[data-year="${year}"]`).forEach(el => { el.checked = checked; });
    this._syncAllCheckbox(prefix);
  },

  _syncAllCheckbox(prefix) {
    const all = document.getElementById(`${prefix}_all`);
    const boxes = [...document.querySelectorAll(`.${prefix}_month`)];
    if (all && boxes.length) all.checked = boxes.every(b => b.checked);
  },
};

const FileIO = {
  supportsSavePicker() {
    return typeof window.showSaveFilePicker === 'function';
  },

  async saveBlob(blob, suggestedName, mimeType) {
    const ext = suggestedName.includes('.') ? suggestedName.split('.').pop() : 'bin';
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{
            description: ext.toUpperCase(),
            accept: { [mimeType]: ['.' + ext] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  },

  async openFile(accept) {
    const exts = accept.split(',').map(s => s.trim()).filter(s => s.startsWith('.'));
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const types = exts.length ? [{ accept: { 'application/octet-stream': exts } }] : undefined;
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types,
        });
        return await handle.getFile();
      } catch (e) {
        if (e.name === 'AbortError') return null;
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  },
};
