const Categorias = {
  render() {
    const el = document.getElementById('tab-categorias');
    const checking = Store.getCheckingBalance();
    const savings = Store.getSavingsBalance();
    const cash = Store.getCashBalance();
    const transfers = Store.getTransfers();
    const totalWealth = (checking !== null && checking !== undefined ? checking : 0) + savings + cash;
    const baseBalance = Store.getCheckingBaseBalance();
    const checkingAvailable = checking !== null ? Math.max(0, checking - baseBalance) : 0;

    el.innerHTML = `
      <div class="sa-card sa-card-cuentas" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">🏦 Mis cuentas</span></div>
        <div class="sa-cuentas-grid">
          <div class="sa-cuenta">
            <div class="sa-cuenta-icon" style="background:var(--primary-light);color:var(--primary)">💳</div>
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
            <div class="sa-cuenta-icon" style="background:var(--income-bg);color:var(--income)">🐷</div>
            <div class="sa-cuenta-info">
              <span class="sa-cuenta-label">Cuenta ahorro</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="sa-cuenta-val" style="color:var(--income)">${savings.toFixed(2)} €</span>
                <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px" onclick="Categorias._setBalance('savings')">✏️</button>
              </div>
            </div>
          </div>
          <div class="sa-cuenta">
            <div class="sa-cuenta-icon" style="background:var(--warn-bg);color:var(--warn)">💵</div>
            <div class="sa-cuenta-info">
              <span class="sa-cuenta-label">Dinero en efectivo</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="sa-cuenta-val" style="color:#D97706">${cash.toFixed(2)} €</span>
                <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px" onclick="Categorias._setBalance('cash')">✏️</button>
              </div>
            </div>
          </div>
        </div>
        ${checking !== null && checking !== undefined ? `<div class="sa-cuenta-total">💰 Patrimonio total: <strong>${totalWealth.toFixed(2)} €</strong> <span style="font-size:11px;color:var(--text-secondary)">(corriente + ahorro + efectivo)</span></div>` : `<div class="sa-cuenta-total">🐷 Ahorro acumulado: <strong>${savings.toFixed(2)} €</strong></div>`}
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

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">📖 Tutorial de uso</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Repasa cómo usar la app, configurar la sincronización en la nube e instalarla en todos tus dispositivos.
        </p>
        <button class="btn btn-primary btn-sm" onclick="Tutorial.open(0)">▶ Ver tutorial</button>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">📲 App e instalación</span>
        </div>
        ${(() => {
          const installed = typeof Install !== 'undefined' && Install.isInstalled();
          const isWin = typeof Install !== 'undefined' && Install._isWindows();
          const isIos = typeof Install !== 'undefined' && Install._isIos();
          const isAndroid = typeof Install !== 'undefined' && Install._isAndroid();

          if (installed) {
            return `<div style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:10px;background:var(--bg);border:1.5px solid var(--income)">
              <span style="font-size:24px">✅</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--income)">App instalada correctamente</div>
                <div style="font-size:11px;color:var(--text-secondary)">La estás usando como app independiente.</div>
              </div>
            </div>`;
          }

          if (isWin) {
            return `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
                Elige cómo instalarla en Windows:
              </p>
              <div style="display:flex;flex-direction:column;gap:8px">
                <a href="${typeof WINDOWS_EXE_URL !== 'undefined' ? WINDOWS_EXE_URL : '#'}" download
                  style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--primary);color:#fff;text-decoration:none;font-weight:600;font-size:13px">
                  <span style="font-size:22px">⬇️</span>
                  <div>
                    <div>Descargar instalador .exe</div>
                    <div style="font-size:11px;font-weight:400;opacity:.85">App de escritorio · siempre carga la versión de Vercel · ~75 MB</div>
                  </div>
                </a>
                <button onclick="Install.promptInstall()"
                  style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--bg);border:1px solid var(--border);cursor:pointer;font-size:13px;text-align:left;width:100%">
                  <span style="font-size:22px">🌐</span>
                  <div>
                    <div style="font-weight:600">Instalar como PWA (Chrome / Edge)</div>
                    <div style="font-size:11px;color:var(--text-secondary)">Icono ⊕ en la barra de direcciones → Instalar</div>
                  </div>
                </button>
              </div>`;
          }

          if (isIos) {
            return `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
                En iPhone e iPad la instalación es gratuita desde Safari — no necesitas la App Store.
              </p>
              <ol style="font-size:12px;line-height:1.9;padding-left:18px;color:var(--text);margin-bottom:12px">
                <li>Abre esta página en <strong>Safari</strong> (no en Chrome)</li>
                <li>Pulsa el botón <strong>Compartir</strong> <span style="font-size:14px">⬆</span> (parte inferior de la pantalla)</li>
                <li>Desplázate y elige <strong>"Añadir a pantalla de inicio"</strong></li>
                <li>Pulsa <strong>Añadir</strong> — aparece un icono como cualquier app</li>
              </ol>
              <div style="font-size:11px;color:var(--text-secondary);background:var(--bg);padding:8px 10px;border-radius:8px">
                La app se abre a pantalla completa, sin barra de Safari, igual que una app nativa. Sin coste de Apple Developer.
              </div>`;
          }

          if (isAndroid) {
            return `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
                En Android se instala desde Chrome como una app normal.
              </p>
              <div style="display:flex;flex-direction:column;gap:8px">
                <button onclick="Install.promptInstall()"
                  style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:var(--primary);border:none;color:#fff;cursor:pointer;font-size:13px;text-align:left;width:100%">
                  <span style="font-size:22px">⬇️</span>
                  <div>
                    <div style="font-weight:600">Instalar app</div>
                    <div style="font-size:11px;opacity:.85">Chrome muestra el diálogo de instalación</div>
                  </div>
                </button>
                <div style="font-size:11px;color:var(--text-secondary);padding:8px 10px;background:var(--bg);border-radius:8px">
                  Si no aparece el botón: menú ⋮ de Chrome → "Instalar app" o "Añadir a pantalla de inicio".
                </div>
              </div>`;
          }

          // macOS / other
          return `<p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
              Instala la app desde el navegador — funciona sin conexión y se actualiza automáticamente.
            </p>
            <button class="btn btn-primary btn-sm" onclick="Install.promptInstall()" style="margin-bottom:8px">⬇ Instalar app</button>
            <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">
              En <strong>Chrome / Edge</strong>: icono ⊕ en la barra de direcciones.<br>
              En <strong>Safari (macOS)</strong>: Archivo → Añadir al Dock.
            </div>`;
        })()}
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">☁️ Sincronización (Supabase)</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.6">
          Conecta tus dispositivos con la misma nube gratuita.
          Los datos se <strong>cifran en tu móvil/PC</strong> (AES-256) antes de subir — Supabase solo guarda un blob ilegible.
        </p>

        <div class="form-group" style="margin-bottom:10px">
          <label style="font-size:12px;font-weight:600">Estado</label>
          <div id="syncStatusLine" style="font-size:13px;padding:8px 10px;border-radius:8px;background:var(--bg)">
            ${esc(Store.getSyncStatusDetail() || Store.getSyncStatus())}
          </div>
        </div>

        <div style="margin-bottom:14px;padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">Cómo configurarlo (una sola vez)</div>
          <ol style="font-size:12px;line-height:1.85;padding-left:18px;color:var(--text-secondary);margin:0">
            <li>Entra en <a href="https://supabase.com" target="_blank" rel="noopener" style="color:var(--primary)">supabase.com</a> y crea un proyecto gratis.</li>
            <li>Abre <strong>SQL Editor</strong> → New query → pega el SQL de abajo → <strong>Run</strong>.
              <span style="opacity:.8">(Si dice que la política ya existe, ignóralo: está bien.)</span></li>
            <li>Ve a <strong>Settings → API Keys</strong> y copia:
              <ul style="margin:4px 0 0;padding-left:16px">
                <li><strong>Project URL</strong> → campo URL abajo</li>
                <li><strong>Publishable key</strong> (<code>sb_publishable_…</code>) → campo clave</li>
              </ul>
            </li>
            <li>Elige un <strong>ID de perfil</strong> (ej. <code>yo</code>) y una <strong>frase secreta</strong>. Pon lo mismo en todos <em>tus</em> dispositivos.</li>
            <li>Pulsa <strong>Guardar y sincronizar</strong>.</li>
          </ol>
          <details style="margin-top:10px">
            <summary style="font-size:11px;font-weight:600;cursor:pointer;color:var(--primary)">Ver / copiar SQL</summary>
            <code id="supabaseSetupSql" style="display:block;margin-top:8px;padding:10px;background:var(--card);border-radius:8px;font-size:10px;white-space:pre;overflow:auto;border:1px solid var(--border)">CREATE TABLE IF NOT EXISTS sync_data (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sync_data ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_data TO anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sync_data' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON sync_data
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;</code>
            <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px"
              onclick="navigator.clipboard.writeText(document.getElementById('supabaseSetupSql').textContent).then(()=>App.showToast('SQL copiado'))">📋 Copiar SQL</button>
          </details>
        </div>

        <div id="supabaseFields">
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:12px;font-weight:600">1. URL del proyecto</label>
            <input type="url" id="supabaseUrl" placeholder="https://xxxxx.supabase.co"
              value="${esc(Store.getSyncSettings().supabaseUrl || '')}"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card);color:var(--text)">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
              Settings → API → <strong>Project URL</strong> (<code>https://xxxxx.supabase.co</code>). No pegues el enlace del panel.
            </div>
          </div>
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:12px;font-weight:600">2. Publishable key</label>
            <div style="position:relative">
              <input type="password" id="supabaseAnonKey" placeholder="sb_publishable_…"
                value="${esc(Store.getSyncSettings().supabaseAnonKey || '')}"
                style="width:100%;padding:8px 36px 8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;box-sizing:border-box;background:var(--card);color:var(--text)">
              <button type="button" onclick="Categorias._toggleFieldVisibility('supabaseAnonKey','supabaseKeyToggle')"
                id="supabaseKeyToggle"
                style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;font-size:14px;color:var(--text-secondary)">👁</button>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
              Settings → API Keys en Supabase. No uses la Secret key.
            </div>
          </div>
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:12px;font-weight:600">3. ID de tu perfil</label>
            <input type="text" id="supabaseRowId" placeholder="ej: yo"
              value="${esc(Store.getSyncSettings().supabaseRowId || '')}"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card);color:var(--text)">
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
              Mismo ID en todos <strong>tus</strong> dispositivos. Tu pareja usará otro (ej. <code>pareja</code>).
            </div>
          </div>
        </div>

        <div class="form-group" style="margin:12px 0 10px;padding:10px;border-radius:8px;background:var(--bg);border:1.5px solid ${Store.isEncryptionEnabled() ? 'var(--income)' : 'var(--border)'}">
          <label style="font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:6px">
            4. Frase de cifrado
            <span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:10px;background:${Store.isEncryptionEnabled() ? 'var(--income)' : 'var(--border)'};color:${Store.isEncryptionEnabled() ? '#fff' : 'var(--text-secondary)'}">
              ${Store.isEncryptionEnabled() ? 'Activo ✓' : 'Obligatoria'}
            </span>
          </label>
          <div style="position:relative">
            <input type="password" id="e2ePassphrase" placeholder="Frase secreta — solo tú la conoces"
              value="${esc(Store.getPassphrase())}"
              style="width:100%;padding:8px 36px 8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;box-sizing:border-box;background:var(--card);color:var(--text)">
            <button type="button" onclick="Categorias._togglePassphraseVisibility()"
              style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;font-size:14px;color:var(--text-secondary)"
              id="passphraseToggleBtn">👁</button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;line-height:1.5">
            Guárdala fuera de la app. Sin ella no se pueden recuperar los datos cifrados.
            Usa la <em>misma frase</em> en todos tus dispositivos.
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="Categorias._saveSyncSettings()">💾 Guardar y sincronizar</button>
          <button class="btn btn-secondary btn-sm" onclick="Categorias._testSync()">🔌 Probar conexión</button>
          <button class="btn btn-secondary btn-sm" onclick="Categorias._forceSync()">🔄 Sincronizar ahora</button>
        </div>

        <!-- Legacy custom server — hidden, not recommended -->
        <details style="margin-top:14px">
          <summary style="font-size:11px;color:var(--text-secondary);cursor:pointer">Modo experto (no recomendado)</summary>
          <div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-secondary);line-height:1.6">
            Solo si mantienes un servidor Node propio. La opción recomendada es Supabase.
            <div class="debt-view-toggle" style="margin:8px 0">
              <button type="button" id="providerBtnSupabase"
                class="cal-type-btn${(Store.getSyncSettings().provider || 'supabase') === 'supabase' ? ' active' : ''}"
                onclick="Categorias._switchSyncProvider('supabase')">Supabase</button>
              <button type="button" id="providerBtnCustom"
                class="cal-type-btn${(Store.getSyncSettings().provider || 'supabase') === 'custom' ? ' active' : ''}"
                onclick="Categorias._switchSyncProvider('custom')">Servidor propio</button>
            </div>
            <div id="customServerFields" style="display:${(Store.getSyncSettings().provider || 'supabase') === 'custom' ? '' : 'none'}">
              <div class="form-group" style="margin-bottom:8px">
                <label style="font-size:12px;font-weight:600;color:var(--text)">URL del servidor</label>
                <input type="url" id="syncServerUrl" placeholder="https://tu-servidor.ejemplo.com"
                  value="${esc(Store.getSyncSettings().serverUrl || '')}"
                  style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card);color:var(--text)">
              </div>
              <div class="form-group">
                <label style="font-size:12px;font-weight:600;color:var(--text)">SYNC_KEY</label>
                <input type="password" id="syncKey" placeholder="Clave del servidor"
                  value="${esc(Store.getSyncSettings().syncKey || '')}"
                  style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--card);color:var(--text)">
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- ══ Espacio compartido con tu pareja ══════════════════════════════════ -->
      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">🤝 Espacio compartido con tu pareja</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.6">
          Mismo proyecto Supabase, <strong>fila y frase distintas a las tuyas</strong>.<br>
          Ninguno puede ver los gastos privados del otro — solo las deudas compartidas.<br>
          <span style="color:var(--income)">🔒 Cifrado AES-256 independiente del cifrado personal.</span>
        </p>

        <div class="form-group" style="margin-bottom:8px">
          <label style="font-size:12px;font-weight:600">ID de fila compartida</label>
          <input type="text" id="sharedRowId" placeholder="compartido (el mismo en ambos dispositivos)"
            value="${esc(Store.getSharedSyncSettings().rowId || '')}"
            style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px">
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
            Inventaos un nombre único (ej: <em>ahorro-compartido-2025</em>). <strong>No es la contraseña</strong>.
          </div>
        </div>

        <div class="form-group" style="margin-bottom:8px">
          <label style="font-size:12px;font-weight:600">Frase compartida <span style="font-weight:400">(misma en ambos dispositivos)</span></label>
          <div style="position:relative">
            <input type="password" id="sharedPassphrase" placeholder="Frase que os acordéis juntos — nunca se sube a la nube"
              value="${esc(Store.getSharedSyncSettings().passphrase || '')}"
              style="width:100%;padding:8px 36px 8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;box-sizing:border-box">
            <button type="button" onclick="Categorias._toggleFieldVisibility('sharedPassphrase','sharedPassphraseToggle')"
              id="sharedPassphraseToggle"
              style="position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer;font-size:14px;color:var(--text-secondary)">👁</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px">
          <label style="font-size:12px;font-weight:600">Estado</label>
          <div id="sharedSyncStatus" style="font-size:13px;padding:8px 10px;border-radius:8px;background:var(--bg)">
            ${Store.isSharedEnabled() ? '🟢 Espacio compartido activo' : '⚫ No configurado'}
          </div>
        </div>

        <div style="font-size:11px;padding:10px;border-radius:8px;background:var(--bg);margin-bottom:12px;line-height:1.7;color:var(--text-secondary)">
          <strong style="color:var(--text)">Tú:</strong> rowId: <code>yo</code>, frase: <em>tu-frase-privada</em><br>
          <strong style="color:var(--text)">Tu pareja:</strong> rowId: <code>pareja</code>, frase: <em>su-frase-privada</em><br>
          <strong style="color:var(--text)">Compartido (ambos):</strong> rowId: <code>compartido</code>, frase: <em>frase-que-acordéis</em>
        </div>

        <button class="btn btn-primary btn-sm" onclick="Categorias._saveSharedSettings()">💾 Guardar espacio compartido</button>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">⚙️ Apariencia</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
          <span style="font-size:13px;font-weight:600">Modo oscuro</span>
          <button id="themeToggleBtn" class="btn btn-sm btn-secondary" onclick="Categorias._toggleTheme()" style="min-width:80px">
            ${document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border)">
          <div>
            <div style="font-size:13px;font-weight:600">PIN de bloqueo</div>
            <div style="font-size:11px;color:var(--text-secondary)">${Store.getPinCode() ? '🔒 Activado' : 'No configurado'}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" onclick="Categorias._setPin()">✏️ ${Store.getPinCode() ? 'Cambiar' : 'Activar'}</button>
            ${Store.getPinCode() ? `<button class="btn btn-sm btn-danger" onclick="Categorias._clearPin()">✕</button>` : ''}
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">💾 Backup y Excel</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
          Exporta o importa tus datos eligiendo <strong>dónde guardar</strong> en el dispositivo.
          Puedes filtrar por meses o años. Si hay datos solapados, eliges: sustituir, conservar o fusionar.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn btn-primary btn-sm" onclick="BackupIO.exportFlow()">⬇ Exportar</button>
          <button class="btn btn-secondary btn-sm" onclick="BackupIO.importFlow()">⬆ Importar</button>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);line-height:1.5">
          <strong>JSON</strong> — copia exacta para restaurar al 100%.<br>
          <strong>Excel</strong> — hojas planas fáciles de editar (Movimientos, Deudas, Metas, Saldos, Config…).<br>
          En Windows/Electron se abre el selector de carpeta del sistema.
        </div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">🔄 Actualizaciones</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          La app detecta automáticamente cuando hay una nueva versión y muestra un aviso. También puedes comprobar manualmente.
        </p>
        <button class="btn btn-secondary btn-sm" onclick="Install.manualCheckForUpdates()">🔍 Comprobar actualizaciones</button>
      </div>

      <div class="card" style="margin-bottom:10px;border-color:var(--expense)">
        <div class="card-header">
          <span class="card-title" style="color:var(--expense)">⚠️ Zona de restablecimiento</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
          Elimina todos los datos de esta app y comienza desde cero. Esta acción no se puede deshacer
          (se crea un backup automático antes de borrar, pero solo en este dispositivo).
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:var(--expense);color:#fff;border:none;padding:8px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600"
            onclick="Categorias._confirmFactoryReset()">
            🗑 Empezar de cero
          </button>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;line-height:1.5">
          Antes de borrar, te recomendamos exportar a Excel o descargar el backup JSON.
        </div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">📚 Catálogo de la app</span>
          <button class="btn btn-secondary btn-sm" onclick="Categorias._syncCatalog()">🔄 Sincronizar</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Categorías, tipos y métodos de pago se comparten con Movimientos, Calendario, Deudas y Ahorro.
          Si añades uno en cualquier pantalla, aparecerá aquí. Pulsa sincronizar para importar los que falten.
        </p>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">👥 Personas y grupos</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">Se guardan al usarlas en deudas o movimientos. Los grupos sirven para dividir gastos rápidamente.</p>
        <div class="cat-section" style="margin-bottom:12px">
          <div class="cat-section-title"><span>Personas guardadas</span></div>
          <div class="cat-list" id="peopleList"></div>
          <div class="add-cat-form">
            <input type="text" id="newPerson" placeholder="Nueva persona...">
            <button onclick="Categorias._addPerson()">Añadir</button>
          </div>
        </div>
        <div class="cat-section">
          <div class="cat-section-title"><span>Grupos</span></div>
          <div class="cat-list" id="groupsList"></div>
          <div class="add-cat-form">
            <input type="text" id="newGroupName" placeholder="Nombre del grupo..." style="flex:1">
            <button onclick="Categorias._addGroup()">+ Grupo</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">🎯 Prioridad de gastos</span>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Define qué es esencial y qué se puede recortar. La app usa estas prioridades para el <strong>resumen semanal/mensual</strong> y para <strong>recomendar variaciones</strong> del presupuesto (comida, salidas, grupos, límites…).
        </p>
        <div class="prio-legend">
          <span class="prio-pill" style="--prio:#059669">1 Esencial</span>
          <span class="prio-pill" style="--prio:#2563EB">2 Alta</span>
          <span class="prio-pill" style="--prio:#D97706">3 Media</span>
          <span class="prio-pill" style="--prio:#EA580C">4 Baja</span>
          <span class="prio-pill" style="--prio:#DC2626">5 Recortar</span>
        </div>
        <div id="expensePrioritiesList"></div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">📂 Grupos de gasto</span>
          <button class="btn btn-primary btn-sm" onclick="Categorias._addCategoryGroup()">+ Nuevo grupo</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Agrupa categorías para asignarles un presupuesto mensual. Los grupos con <strong>Plan comida</strong> activado se deducen del presupuesto semanal como gasto obligatorio y mejoran el cálculo de "HOY PUEDES GASTAR".
        </p>
        <div id="categoryGroupsList"></div>
      </div>

      <div class="card" style="margin-bottom:10px">
        <div class="card-header">
          <span class="card-title">💰 Grupos de ingreso</span>
          <button class="btn btn-primary btn-sm" onclick="Categorias._addIncomeGroup()">+ Nuevo grupo</button>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;line-height:1.5">
          Agrupa categorías de ingreso (nómina, extras, pagas…) y opcionalmente define un <strong>objetivo mensual</strong> para ver si vas al ritmo.
        </p>
        <div id="incomeGroupsList"></div>
      </div>

      <div class="cat-grid">
        <div class="cat-section">
          <div class="cat-section-title">
            <span>Categorías de gasto</span>
          </div>
          <div class="cat-list" id="catList"></div>
          <div class="add-cat-form">
            <input type="text" id="newCategory" placeholder="Nueva categoría de gasto...">
            <button onclick="Categorias._add('category')">Añadir</button>
          </div>
        </div>
        <div class="cat-section">
          <div class="cat-section-title">
            <span>Categorías de ingreso</span>
          </div>
          <div class="cat-list" id="incomeCatList"></div>
          <div class="add-cat-form">
            <input type="text" id="newIncomeCategory" placeholder="Nueva categoría de ingreso...">
            <button onclick="Categorias._add('incomeCategory')">Añadir</button>
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
    this._renderList('incomeCatList', Store.getIncomeCategories(), 'incomeCategory');
    this._renderList('typeList', Store.getTypes(), 'type');
    this._renderList('methodList', Store.getPaymentMethods(), 'method');
    this._renderPeople();
    this._renderGroups();
    this._renderCategoryGroups();
    this._renderIncomeGroups();
    this._renderExpensePriorities();

    document.getElementById('newCategory').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('category'); });
    document.getElementById('newIncomeCategory').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('incomeCategory'); });
    document.getElementById('newType').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('type'); });
    document.getElementById('newMethod').addEventListener('keydown', e => { if (e.key === 'Enter') this._add('method'); });
    document.getElementById('newPerson')?.addEventListener('keydown', e => { if (e.key === 'Enter') this._addPerson(); });
  },

  _syncCatalog() {
    Store.syncCatalogFromData();
    this.render();
    App._refreshConfigDependents?.();
    App.showToast('✅ Catálogo sincronizado con todos los movimientos');
  },

  _renderPeople() {
    const el = document.getElementById('peopleList');
    if (!el) return;
    const people = Store.getPeople();
    el.innerHTML = people.length ? people.map(p => {
      const safe = p.replace(/'/g, "\\'");
      const used = (Store.getDebts() || []).filter(d => d.person === p).length;
      return `<div class="cat-item"><span class="cat-name">${esc(p)}${used ? ` <span style="font-size:10px;color:var(--text-secondary)">(${used} deuda${used !== 1 ? 's' : ''})</span>` : ''}</span>
        <div style="display:flex;gap:4px"><button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px;padding:2px 6px" onclick="Categorias._renamePerson('${safe}')">✏️</button>
        <button class="delete-cat" onclick="Categorias._deletePerson('${safe}')">✕</button></div></div>`;
    }).join('') : '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">Sin personas guardadas aún</div>';
  },

  _renderGroups() {
    const el = document.getElementById('groupsList');
    if (!el) return;
    const groups = Store.getPeopleGroups();
    el.innerHTML = groups.length ? groups.map(g => `<div class="cat-item">
      <span class="cat-name">👥 ${esc(g.name)} <span style="font-size:10px;color:var(--text-secondary)">${g.members.map(esc).join(', ')}</span></span>
      <div style="display:flex;gap:4px">
        <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px;padding:2px 6px" onclick="Categorias._editGroup('${g.id}')">✏️</button>
        <button class="delete-cat" onclick="Categorias._deleteGroup('${g.id}')">✕</button>
      </div></div>`).join('') : '<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">Sin grupos aún</div>';
  },

  _addPerson() {
    const name = document.getElementById('newPerson')?.value.trim();
    if (!name) return;
    Store.addPerson(name);
    document.getElementById('newPerson').value = '';
    this._renderPeople();
  },

  _renamePerson(name) {
    App.showPrompt('Renombrar persona', 'Nuevo nombre:', name, (n) => {
      if (n && n !== name) { Store.renamePerson(name, n); this.render(); Deudas.render(); }
    });
  },

  _deletePerson(name) {
    App.showConfirm('Eliminar persona', `¿Eliminar "${name}" de la lista? (no borra deudas existentes)`, () => {
      Store.deletePerson(name);
      this._renderPeople();
    });
  },

  _addGroup() {
    const name = document.getElementById('newGroupName')?.value.trim();
    if (!name) return;
    const people = Store.getPeople();
    const opts = people.map(p => `<label style="display:flex;gap:6px;padding:4px 0"><input type="checkbox" value="${esc(p)}"> ${esc(p)}</label>`).join('');
    App.showCustom('👥 Nuevo grupo', `
      <div class="form-group"><label>Nombre</label><input type="text" id="grpNameInput" value="${esc(name)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
      <div class="form-group"><label>Miembros</label><div id="grpMembersList">${opts || '<p style="font-size:12px;color:var(--text-secondary)">Añade personas primero</p>'}</div>
        <input type="text" id="grpNewMember" placeholder="O escribe un nombre nuevo" style="width:100%;margin-top:6px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>`, 'Crear', () => {
      const gName = document.getElementById('grpNameInput')?.value.trim();
      const checked = [...document.querySelectorAll('#grpMembersList input:checked')].map(el => el.value);
      const extra = document.getElementById('grpNewMember')?.value.trim();
      if (extra) checked.push(extra);
      if (!gName || checked.length === 0) { App.showToast('Indica nombre y al menos un miembro'); return; }
      Store.addPeopleGroup(gName, checked);
      document.getElementById('newGroupName').value = '';
      this._renderGroups();
      this._renderPeople();
    });
  },

  _editGroup(id) {
    const g = Store.getPeopleGroups().find(x => x.id === id);
    if (!g) return;
    const people = Store.getPeople();
    const opts = people.map(p => `<label style="display:flex;gap:6px;padding:4px 0"><input type="checkbox" value="${esc(p)}"${g.members.includes(p) ? ' checked' : ''}> ${esc(p)}</label>`).join('');
    App.showCustom('✏️ Editar grupo', `
      <div class="form-group"><label>Nombre</label><input type="text" id="grpNameInput" value="${esc(g.name)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)"></div>
      <div class="form-group"><label>Miembros</label><div id="grpMembersList">${opts}</div></div>`, 'Guardar', () => {
      const gName = document.getElementById('grpNameInput')?.value.trim();
      const checked = [...document.querySelectorAll('#grpMembersList input:checked')].map(el => el.value);
      if (!gName || checked.length === 0) return;
      Store.updatePeopleGroup(id, { name: gName, members: checked });
      this._renderGroups();
      this._renderPeople();
    });
  },

  _deleteGroup(id) {
    App.showConfirm('Eliminar grupo', '¿Eliminar este grupo?', () => {
      Store.deletePeopleGroup(id);
      this._renderGroups();
    });
  },

  // ── Prioridad de gastos ───────────────────────────────────────────────────

  _renderExpensePriorities() {
    const el = document.getElementById('expensePrioritiesList');
    if (!el) return;
    const items = Store.getPriorityConfigItems();
    if (!items.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:6px 0">Crea grupos de gasto o categorías para configurar prioridades.</div>';
      return;
    }

    el.innerHTML = items.map(item => {
      const meta = BudgetEngine.getPriorityMeta(item.priority);
      const safeKey = encodeURIComponent(item.key);
      return `<div class="prio-row">
        <div class="prio-row-info">
          <span class="prio-row-emoji">${item.emoji}</span>
          <div>
            <div class="prio-row-name">${esc(item.name)}</div>
            <div class="prio-row-hint">${esc(item.hint)} · <span style="color:${meta.color};font-weight:600">${meta.label}</span></div>
          </div>
        </div>
        <div class="prio-btns">
          ${[1, 2, 3, 4, 5].map(p => {
            const m = BudgetEngine.getPriorityMeta(p);
            const active = item.priority === p;
            return `<button type="button" class="prio-btn ${active ? 'active' : ''}" style="${active ? `background:${m.color};border-color:${m.color};color:#fff` : ''}"
              title="${m.label}: ${m.tip}"
              onclick="Categorias._setPriority('${safeKey}', ${p})">${p}</button>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  },

  _setPriority(encodedKey, priority) {
    const key = decodeURIComponent(encodedKey);
    Store.setExpensePriority(key, priority);
    this._renderExpensePriorities();
    App._refreshConfigDependents?.();
    const meta = BudgetEngine.getPriorityMeta(priority);
    App.showToast(`Prioridad ${meta.label} guardada`);
  },

  // ── Grupos de gasto (presupuesto) ─────────────────────────────────────────

  _renderCategoryGroups() {
    const el = document.getElementById('categoryGroupsList');
    if (!el) return;
    const groups = Store.getCategoryGroups();

    if (groups.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:6px 0">Sin grupos aún. Crea uno para organizar tus categorías de gasto.</div>';
      return;
    }

    const weekExpenses = BudgetEngine.getWeekSpendableExpenses();

    el.innerHTML = groups.map(g => {
      const weeklyBudget = g.monthlyBudget > 0 ? g.monthlyBudget / 4.33 : 0;
      const weekSpent = weekExpenses.filter(t => g.categories.includes(t.category)).reduce((s, t) => s + t.amount, 0);
      const pct = weeklyBudget > 0 ? Math.min(100, (weekSpent / weeklyBudget) * 100) : 0;
      const barColor = pct >= 100 ? 'var(--expense)' : pct >= 80 ? '#F97316' : pct >= 50 ? '#F59E0B' : 'var(--income)';
      const emojiDisplay = g.emoji ? `<span style="font-size:18px">${g.emoji}</span>` : '';

      return `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${emojiDisplay}
            <span style="font-size:14px;font-weight:700">${esc(g.name)}</span>
            ${g.isFoodGroup ? '<span style="font-size:10px;background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:10px;font-weight:600">🍽️ Plan comida</span>' : '<span style="font-size:10px;background:var(--bg);color:var(--text-secondary);padding:2px 6px;border-radius:10px">📊 Seguimiento</span>'}
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px;padding:2px 6px" onclick="Categorias._editCategoryGroup('${g.id}')">✏️</button>
            <button class="delete-cat" onclick="Categorias._deleteCategoryGroup('${g.id}')">✕</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
          ${g.categories.length ? g.categories.map(c => `<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">${esc(c)}</span>`).join('') : '<span style="font-size:11px;color:var(--text-secondary)">Sin categorías asignadas</span>'}
        </div>
        ${g.monthlyBudget > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-bottom:3px">
          <span>${weekSpent.toFixed(1)}€ / ${weeklyBudget.toFixed(1)}€ sem (${g.monthlyBudget.toFixed(0)}€/mes)</span>
          <span style="color:${barColor};font-weight:600">${weeklyBudget > weekSpent ? (weeklyBudget - weekSpent).toFixed(1) + '€ restan' : (weekSpent - weeklyBudget).toFixed(1) + '€ excedido'}</span>
        </div>
        <div style="height:5px;background:var(--bg);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .3s"></div>
        </div>` : `<span style="font-size:11px;color:var(--text-secondary)">Sin presupuesto — solo seguimiento visual</span>`}
      </div>`;
    }).join('');
  },

  _addCategoryGroup() {
    const allCats = Store.getCategories();
    const groups = Store.getCategoryGroups();
    const usedCats = new Set(groups.flatMap(g => g.categories));

    const emojiPalette = ['🍔','🛒','☕','🍕','🏠','🚗','💊','📚','👗','🎮','✈️','🎁','💪','🌟','🔧','📱','🎵','🏋️','🐾','🌿','🎨','🎭','🛍️','🏖️','💡'];
    App.showCustom('📂 Nuevo grupo de gasto', `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Nombre del grupo</label>
          <input type="text" id="cgNameInput" placeholder="Ej: Alimentación, Ocio..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group" style="width:80px;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Emoji</label>
          <input type="text" id="cgEmojiInput" placeholder="😀" maxlength="2" style="width:100%;text-align:center;font-size:22px;padding:6px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">
        ${emojiPalette.map(e => `<button type="button" onclick="document.getElementById('cgEmojiInput').value='${e}'" style="font-size:18px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 5px">${e}</button>`).join('')}
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px;font-weight:600">Presupuesto mensual (€)</label>
        <input type="number" id="cgBudgetInput" placeholder="0 = solo seguimiento" step="5" min="0" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Pon 0 para seguimiento visual sin afectar el plan financiero</div>
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px;background:var(--bg);border-radius:8px">
          <input type="checkbox" id="cgFoodToggle">
          <div>
            <div style="font-size:12px;font-weight:700">🍽️ Incluir en plan comida (gasto obligatorio)</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Actívalo para que el presupuesto del grupo se reste del ingreso semanal como comida/necesidades, liberando el disponible discrecional</div>
          </div>
        </label>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Categorías del grupo</label>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:6px">
          ${allCats.map(c => {
            const inOtherGroup = usedCats.has(c);
            const otherGroupName = inOtherGroup ? (groups.find(g => g.categories.includes(c))?.name || '') : '';
            return `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer">
              <input type="checkbox" class="cg-cat-check" value="${esc(c)}" ${inOtherGroup ? 'disabled' : ''}>
              <span style="font-size:13px${inOtherGroup ? ';color:var(--text-secondary)' : ''}">${esc(c)}</span>
              ${inOtherGroup ? `<span style="font-size:10px;color:var(--text-secondary)">(ya en ${esc(otherGroupName)})</span>` : ''}
            </label>`;
          }).join('')}
        </div>
      </div>
    `, 'Crear grupo', () => {
      const name = document.getElementById('cgNameInput')?.value.trim();
      const emoji = document.getElementById('cgEmojiInput')?.value.trim() || '';
      const budget = parseFloat(document.getElementById('cgBudgetInput')?.value) || 0;
      const isFood = document.getElementById('cgFoodToggle')?.checked || false;
      const cats = [...document.querySelectorAll('.cg-cat-check:checked')].map(el => el.value);
      if (!name) { App.showToast('⚠️ Indica un nombre para el grupo'); return; }
      Store.addCategoryGroup(name, { categories: cats, monthlyBudget: budget, isFoodGroup: isFood, emoji });
      App.showToast(`✅ Grupo "${name}" creado`);
      this._renderCategoryGroups();
      this._renderExpensePriorities();
      App._refreshConfigDependents?.();
    });
  },

  _editCategoryGroup(id) {
    const g = Store.getCategoryGroups().find(x => x.id === id);
    if (!g) return;
    const allCats = Store.getCategories();
    const groups = Store.getCategoryGroups();
    const otherGroupCats = new Set(groups.filter(x => x.id !== id).flatMap(x => x.categories));

    const emojiPalette2 = ['🍔','🛒','☕','🍕','🏠','🚗','💊','📚','👗','🎮','✈️','🎁','💪','🌟','🔧','📱','🎵','🏋️','🐾','🌿','🎨','🎭','🛍️','🏖️','💡'];
    App.showCustom(`✏️ Editar grupo "${esc(g.name)}"`, `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Nombre</label>
          <input type="text" id="cgNameInput" value="${esc(g.name)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group" style="width:80px;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Emoji</label>
          <input type="text" id="cgEmojiInput" placeholder="😀" maxlength="2" value="${esc(g.emoji || '')}" style="width:100%;text-align:center;font-size:22px;padding:6px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">
        ${emojiPalette2.map(e => `<button type="button" onclick="document.getElementById('cgEmojiInput').value='${e}'" style="font-size:18px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 5px">${e}</button>`).join('')}
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px;font-weight:600">Presupuesto mensual (€)</label>
        <input type="number" id="cgBudgetInput" value="${g.monthlyBudget || ''}" placeholder="0 = solo seguimiento" step="5" min="0" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px;background:var(--bg);border-radius:8px">
          <input type="checkbox" id="cgFoodToggle" ${g.isFoodGroup ? 'checked' : ''}>
          <div>
            <div style="font-size:12px;font-weight:700">🍽️ Incluir en plan comida (gasto obligatorio)</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">El presupuesto del grupo se resta como comida del ingreso semanal</div>
          </div>
        </label>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Categorías del grupo</label>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:6px">
          ${allCats.map(c => {
            const inOther = otherGroupCats.has(c);
            const otherName = inOther ? (groups.find(x => x.id !== id && x.categories.includes(c))?.name || '') : '';
            return `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer">
              <input type="checkbox" class="cg-cat-check" value="${esc(c)}" ${g.categories.includes(c) ? 'checked' : ''} ${inOther ? 'disabled' : ''}>
              <span style="font-size:13px${inOther ? ';color:var(--text-secondary)' : ''}">${esc(c)}</span>
              ${inOther ? `<span style="font-size:10px;color:var(--text-secondary)">(en ${esc(otherName)})</span>` : ''}
            </label>`;
          }).join('')}
        </div>
      </div>
    `, 'Guardar', () => {
      const name = document.getElementById('cgNameInput')?.value.trim();
      const emoji = document.getElementById('cgEmojiInput')?.value.trim() || '';
      const budget = parseFloat(document.getElementById('cgBudgetInput')?.value) || 0;
      const isFood = document.getElementById('cgFoodToggle')?.checked || false;
      const cats = [...document.querySelectorAll('.cg-cat-check:checked')].map(el => el.value);
      if (!name) { App.showToast('⚠️ Indica un nombre para el grupo'); return; }
      Store.updateCategoryGroup(id, { name, categories: cats, monthlyBudget: budget, isFoodGroup: isFood, emoji });
      App.showToast(`✅ Grupo "${name}" actualizado`);
      this._renderCategoryGroups();
      this._renderExpensePriorities();
      App._refreshConfigDependents?.();
    });
  },

  _deleteCategoryGroup(id) {
    const g = Store.getCategoryGroups().find(x => x.id === id);
    if (!g) return;
    App.showConfirm(`Eliminar grupo "${g.name}"`, '¿Eliminar este grupo? Las categorías quedarán sin grupo asignado.', () => {
      Store.deleteCategoryGroup(id);
      this._renderCategoryGroups();
      this._renderExpensePriorities();
      App._refreshConfigDependents?.();
    });
  },

  // ── Grupos de ingreso ─────────────────────────────────────────────────────

  _renderIncomeGroups() {
    const el = document.getElementById('incomeGroupsList');
    if (!el) return;
    const groups = Store.getIncomeGroups();
    const month = Store.getCurrentMonth();
    const monthIncomes = Store.getTransactions().filter(t =>
      t.month === month && t.type === 'Ingreso' && !Store.isAdjustment(t)
    );

    if (groups.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);padding:6px 0">Sin grupos aún. Crea uno para organizar tus categorías de ingreso.</div>';
      return;
    }

    el.innerHTML = groups.map(g => {
      const spent = monthIncomes
        .filter(t => g.categories.includes(t.category))
        .reduce((s, t) => s + t.amount, 0);
      const target = g.monthlyTarget || 0;
      const pct = target > 0 ? Math.min(100, (spent / target) * 100) : 0;
      const barColor = target > 0 && spent >= target ? 'var(--income)' : '#10B981';
      const emojiDisplay = g.emoji ? `<span style="font-size:18px">${g.emoji}</span>` : '';

      return `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${emojiDisplay}
            <span style="font-size:14px;font-weight:700">${esc(g.name)}</span>
            <span style="font-size:10px;background:#ECFDF5;color:#065F46;padding:2px 6px;border-radius:10px;font-weight:600">💰 Ingreso</span>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px;padding:2px 6px" onclick="Categorias._editIncomeGroup('${g.id}')">✏️</button>
            <button class="delete-cat" onclick="Categorias._deleteIncomeGroup('${g.id}')">✕</button>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
          ${g.categories.length ? g.categories.map(c => `<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:10px">${esc(c)}</span>`).join('') : '<span style="font-size:11px;color:var(--text-secondary)">Sin categorías asignadas</span>'}
        </div>
        ${target > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary);margin-bottom:3px">
          <span>${spent.toFixed(0)}€ / ${target.toFixed(0)}€ este mes</span>
          <span style="color:${barColor};font-weight:600">${spent >= target ? '✅ Objetivo cumplido' : `${(target - spent).toFixed(0)}€ por llegar`}</span>
        </div>
        <div style="height:5px;background:var(--bg);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .3s"></div>
        </div>` : `<div style="font-size:11px;color:var(--text-secondary)">Este mes: <strong style="color:var(--income)">${spent.toFixed(0)} €</strong> · Sin objetivo mensual</div>`}
      </div>`;
    }).join('');
  },

  _incomeGroupForm(existing) {
    const allCats = Store.getIncomeCategories();
    const groups = Store.getIncomeGroups();
    const usedCats = new Set(groups.filter(g => !existing || g.id !== existing.id).flatMap(g => g.categories));
    const emojiPalette = ['💰','💼','🏦','🎁','📈','🪙','🏠','👨‍👩‍👧','⭐','🌟','💵','🧾'];
    const g = existing || {};
    return `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Nombre del grupo</label>
          <input type="text" id="igNameInput" placeholder="Ej: Nómina, Extras..." value="${esc(g.name || '')}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
        <div class="form-group" style="width:80px;margin-bottom:0">
          <label style="font-size:12px;font-weight:600">Emoji</label>
          <input type="text" id="igEmojiInput" placeholder="😀" maxlength="2" value="${esc(g.emoji || '')}" style="width:100%;text-align:center;font-size:22px;padding:6px;border:1px solid var(--border);border-radius:var(--radius)">
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px">
        ${emojiPalette.map(e => `<button type="button" onclick="document.getElementById('igEmojiInput').value='${e}'" style="font-size:18px;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px 5px">${e}</button>`).join('')}
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px;font-weight:600">Objetivo mensual (€)</label>
        <input type="number" id="igTargetInput" placeholder="0 = solo seguimiento" step="10" min="0" value="${g.monthlyTarget || ''}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">Opcional: cuánto esperas ingresar al mes en este grupo</div>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Categorías del grupo</label>
        <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:6px">
          ${allCats.length ? allCats.map(c => {
            const inOther = usedCats.has(c);
            const otherName = inOther ? (groups.find(x => (!existing || x.id !== existing.id) && x.categories.includes(c))?.name || '') : '';
            const checked = (g.categories || []).includes(c);
            return `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer">
              <input type="checkbox" class="ig-cat-check" value="${esc(c)}" ${checked ? 'checked' : ''} ${inOther ? 'disabled' : ''}>
              <span style="font-size:13px${inOther ? ';color:var(--text-secondary)' : ''}">${esc(c)}</span>
              ${inOther ? `<span style="font-size:10px;color:var(--text-secondary)">(en ${esc(otherName)})</span>` : ''}
            </label>`;
          }).join('') : '<p style="font-size:12px;color:var(--text-secondary)">Añade categorías de ingreso primero</p>'}
        </div>
      </div>`;
  },

  _readIncomeGroupForm() {
    const name = document.getElementById('igNameInput')?.value.trim();
    const emoji = document.getElementById('igEmojiInput')?.value.trim() || '';
    const monthlyTarget = parseFloat(document.getElementById('igTargetInput')?.value) || 0;
    const cats = [...document.querySelectorAll('.ig-cat-check:checked')].map(el => el.value);
    return { name, emoji, monthlyTarget, categories: cats };
  },

  _addIncomeGroup() {
    App.showCustom('💰 Nuevo grupo de ingreso', this._incomeGroupForm(null), 'Crear grupo', () => {
      const data = this._readIncomeGroupForm();
      if (!data.name) { App.showToast('⚠️ Indica un nombre para el grupo'); return; }
      Store.addIncomeGroup(data.name, data);
      App.showToast(`✅ Grupo "${data.name}" creado`);
      this._renderIncomeGroups();
      App._refreshConfigDependents?.();
    });
  },

  _editIncomeGroup(id) {
    const g = Store.getIncomeGroups().find(x => x.id === id);
    if (!g) return;
    App.showCustom(`✏️ Editar grupo "${esc(g.name)}"`, this._incomeGroupForm(g), 'Guardar', () => {
      const data = this._readIncomeGroupForm();
      if (!data.name) { App.showToast('⚠️ Indica un nombre para el grupo'); return; }
      Store.updateIncomeGroup(id, data);
      App.showToast(`✅ Grupo "${data.name}" actualizado`);
      this._renderIncomeGroups();
      App._refreshConfigDependents?.();
    });
  },

  _deleteIncomeGroup(id) {
    const g = Store.getIncomeGroups().find(x => x.id === id);
    if (!g) return;
    App.showConfirm(`Eliminar grupo "${g.name}"`, '¿Eliminar este grupo? Las categorías quedarán sin grupo.', () => {
      Store.deleteIncomeGroup(id);
      this._renderIncomeGroups();
      App._refreshConfigDependents?.();
    });
  },

  _renderList(listId, items, type) {
    const el = document.getElementById(listId);
    const usedItems = this._getUsedItems(type);
    const usage = Store.getCatalogUsage();
    const usageKey = { category: 'category', incomeCategory: 'incomeCategory', type: 'type', method: 'method' }[type];
    const usageMap = usage[usageKey] || {};
    el.innerHTML = items.map(item => {
      const inUse = usedItems.has(item);
      const count = usageMap[item] || 0;
      const safeItem = item.replace(/'/g, "\\'");
      const canEdit = type === 'category' || type === 'incomeCategory' || type === 'type' || type === 'method';
      return `
        <div class="cat-item">
          <span class="cat-name">${esc(item)}${count ? ` <span style="font-size:10px;color:var(--text-secondary)">(${count})</span>` : ''}</span>
          <div style="display:flex;gap:4px;align-items:center">
            ${canEdit ? `<button class="btn-sm" style="border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-size:11px;padding:2px 6px" title="Renombrar" onclick="Categorias._rename('${type}', '${safeItem}')">✏️</button>` : ''}
            <button class="delete-cat" onclick="Categorias._delete('${type}', '${safeItem}')"
              title="${inUse ? 'En uso — al eliminar podrás reasignar' : 'Eliminar'}">✕</button>
          </div>
        </div>
      `;
    }).join('');
  },

  _getUsedItems(type) {
    const transactions = Store.getTransactions();
    const archives = Store.getArchives();
    const used = new Set();

    const checkTx = (tx) => {
      if (type === 'category' && tx.type !== 'Ingreso') used.add(tx.category);
      else if (type === 'incomeCategory' && tx.type === 'Ingreso') used.add(tx.category);
      else if (type === 'type') used.add(tx.type);
      else if (type === 'method') used.add(tx.paymentMethod);
    };

    transactions.forEach(checkTx);
    Object.values(archives).forEach(txs => txs.forEach(checkTx));

    for (const debt of Store.getDebts() || []) {
      if (type === 'category' && debt.category) used.add(debt.category);
    }
    for (const r of Store.getData().recurringTransactions || []) {
      if (type === 'category' && r.type !== 'Ingreso') used.add(r.category);
      else if (type === 'incomeCategory' && r.type === 'Ingreso') used.add(r.category);
      else if (type === 'type') used.add(r.type);
      else if (type === 'method') used.add(r.paymentMethod);
    }

    return used;
  },

  _afterCatalogChange() {
    this.render();
    App._refreshConfigDependents?.();
  },

  _add(type) {
    const inputId = { category: 'newCategory', incomeCategory: 'newIncomeCategory', type: 'newType', method: 'newMethod' }[type];
    const input = document.getElementById(inputId);
    const name = input.value.trim();
    if (!name) return;

    if (type === 'category') Store.addCategory(name);
    else if (type === 'incomeCategory') Store.addIncomeCategory(name);
    else if (type === 'type') Store.addType(name);
    else Store.addPaymentMethod(name);

    input.value = '';
    this._afterCatalogChange();
  },

  _rename(type, name) {
    const isIncome = type === 'incomeCategory';
    const isType = type === 'type';
    const isMethod = type === 'method';
    const otherCats = isIncome
      ? Store.getIncomeCategories().filter(c => c !== name)
      : isType ? Store.getTypes().filter(c => c !== name)
      : isMethod ? Store.getPaymentMethods().filter(c => c !== name)
      : Store.getCategories().filter(c => c !== name);

    App.showCustom(`✏️ Renombrar "${name}"`, `
      <div class="form-group">
        <label>Nuevo nombre</label>
        <input type="text" id="renameCatInput" value="${esc(name)}"
          style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:15px">
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Se actualizará en todos los movimientos y pantallas.</div>
      </div>
    `, 'Renombrar', () => {
      const newName = document.getElementById('renameCatInput')?.value.trim();
      if (!newName || newName === name) return;
      if (otherCats.includes(newName)) { App.showToast('⚠️ Ya existe ese nombre'); return; }
      let ok = false;
      if (isIncome) ok = Store.renameIncomeCategory(name, newName);
      else if (isType) ok = Store.renameType(name, newName);
      else if (isMethod) ok = Store.renamePaymentMethod(name, newName);
      else ok = Store.renameCategory(name, newName);
      if (ok) {
        App.showToast(`✅ "${name}" → "${newName}"`);
        this._afterCatalogChange();
      } else App.showToast('⚠️ No se pudo renombrar');
    });
    setTimeout(() => { const inp = document.getElementById('renameCatInput'); if (inp) { inp.focus(); inp.select(); } }, 80);
  },

  _delete(type, name) {
    const usedItems = this._getUsedItems(type);
    const inUse = usedItems.has(name);
    const isIncome = type === 'incomeCategory';

    if (!inUse) {
      App.showConfirm('Eliminar', `¿Eliminar "${name}"?`, () => {
        if (type === 'category') Store.deleteCategory(name);
        else if (type === 'incomeCategory') Store.deleteIncomeCategory(name);
        else if (type === 'type') Store.deleteType(name);
        else Store.deletePaymentMethod(name);
        this._afterCatalogChange();
      });
      return;
    }

    if (type === 'type' || type === 'method') {
      const alternatives = type === 'type'
        ? Store.getTypes().filter(t => t !== name)
        : Store.getPaymentMethods().filter(m => m !== name);
      const defaultTarget = type === 'type' ? 'Gasto' : 'Tarjeta';
      App.showCustom(`🗑️ Eliminar "${name}"`, `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Está en uso. Reasigna los movimientos afectados:</p>
        <select id="reassignTarget" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          ${alternatives.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
        </select>`, 'Eliminar', () => {
        const target = document.getElementById('reassignTarget')?.value || defaultTarget;
        if (type === 'type') { Store.reassignType(name, target); Store.deleteType(name); }
        else { Store.reassignPaymentMethod(name, target); Store.deletePaymentMethod(name); }
        App.showToast(`✅ Reasignado a "${target}"`);
        this._afterCatalogChange();
      });
      return;
    }

    // Category is in use — ask for reassignment before deleting
    const alternatives = isIncome
      ? Store.getIncomeCategories().filter(c => c !== name)
      : Store.getCategories().filter(c => c !== name);

    const altOptions = alternatives.map(c =>
      `<option value="${esc(c)}">${esc(c)}</option>`
    ).join('');

    const hasLimit = !isIncome && Store.getCategoryLimits()[name] !== undefined;

    App.showCustom(`🗑️ Eliminar categoría "${name}"`, `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">
        Esta categoría está usada en movimientos. Elige qué hacer con ellos:
      </p>
      <div class="form-group">
        <label>Reasignar movimientos a</label>
        <select id="reassignTarget" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius)">
          <option value="">— Dejar sin categoría (Otros)</option>
          ${altOptions}
        </select>
      </div>
      ${hasLimit ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:6px">⚠️ El límite semanal de esta categoría también se eliminará.</p>` : ''}
    `, 'Eliminar', () => {
      let target = document.getElementById('reassignTarget')?.value || '';
      if (!target) target = isIncome ? (alternatives[0] || 'Extra') : 'Otros';
      if (!isIncome && !Store.getCategories().includes(target)) Store.addCategory(target);
      if (isIncome && !Store.getIncomeCategories().includes(target)) Store.addIncomeCategory(target);
      Store.reassignCategory(name, target, isIncome);
      if (type === 'category') Store.deleteCategory(name);
      else Store.deleteIncomeCategory(name);
      App.showToast(`✅ "${name}" eliminado. Movimientos → "${target}"`);
      this._afterCatalogChange();
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
    const computed = type === 'checking' ? (Store.getCheckingBalance() ?? 0)
      : type === 'cash' ? Store.getCashBalance()
      : (Store.getSavingsBalance() || 0);
    const label = { checking: 'Cuenta corriente', savings: 'Cuenta ahorro', cash: 'Efectivo' }[type];
    const icon = { checking: '💳', savings: '🐷', cash: '💵' }[type];

    // Cash: direct set without adjustment transaction system
    if (type === 'cash') {
      App.showCustom(`${icon} Efectivo en cartera`, `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">Indica el efectivo que tienes actualmente. Los movimientos con pago en Efectivo actualizarán este saldo automáticamente.</p>
        <div class="form-group"><label>Efectivo actual (€)</label>
          <input type="number" id="cashBalInput" value="${computed.toFixed(2)}" step="0.01"
            style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:18px;font-weight:700;width:100%">
        </div>
      `, 'Guardar', () => {
        const v = parseFloat(document.getElementById('cashBalInput').value);
        if (!isNaN(v) && v >= 0) { Store.setCashBalance(v); Categorias.render(); }
      });
      return;
    }

    const initialKey = type === 'checking' ? 'Saldo inicial (corriente)' : 'Saldo inicial (ahorro)';
    const initialVal = type === 'checking' ? Store.getInitialCheckingBalance() : Store.getInitialSavingsBalance();

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
    const result = Store.createAccountTransfer({
      amount: amt,
      description: note || 'Traspaso a ahorro',
      logNote: note || '',
      transferType: 'to_savings',
      emoji: '🐷',
    });
    const fb = document.getElementById('transferFeedback');
    if (result === -1) {
      fb.style.display = 'block';
      fb.style.color = 'var(--expense)';
      fb.textContent = '❌ No tienes suficiente saldo en la cuenta corriente';
      return;
    }
    if (!result) return;
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferNote').value = '';
    fb.style.display = 'block';
    fb.style.color = 'var(--income)';
    fb.textContent = `✅ ${amt.toFixed(2)} € transferidos a la cuenta ahorro (traspaso)`;
    this.render();
    App._refreshConfigDependents?.();
  },

  _toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('appTheme', next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0F172A' : '#4F46E5');
    this.render();
  },

  _setPin() {
    App.openModal({
      title: '🔒 Configura tu PIN',
      body: `<div class="form-group">
        <label>PIN de 4 dígitos</label>
        <input type="password" id="pinSetInput" inputmode="numeric" maxlength="4"
          style="width:100%;text-align:center;font-size:28px;letter-spacing:10px;padding:10px;border:2px solid var(--border);border-radius:10px">
      </div>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">Se pedirá al abrir la app.</p>`,
      actions: [
        { label: 'Cancelar' },
        { label: 'Guardar', primary: true, cb: () => {
          const v = document.getElementById('pinSetInput')?.value;
          if (v && v.length === 4 && /^\d{4}$/.test(v)) {
            Store.setPinCode(v);
            App.showToast('🔒 PIN configurado');
            Categorias.render();
          } else {
            App.showToast('⚠️ El PIN debe ser de exactamente 4 dígitos');
          }
        }},
      ],
    });
    setTimeout(() => document.getElementById('pinSetInput')?.focus(), 100);
  },

  _clearPin() {
    App.showConfirm('Desactivar PIN', '¿Desactivar el bloqueo por PIN?', () => {
      Store.clearPinCode();
      App.showToast('🔓 PIN desactivado');
      Categorias.render();
    });
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

  _togglePassphraseVisibility() {
    const inp = document.getElementById('e2ePassphrase');
    const btn = document.getElementById('passphraseToggleBtn');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  },

  _switchSyncProvider(provider) {
    const custom = document.getElementById('customServerFields');
    if (custom) custom.style.display = provider === 'custom' ? '' : 'none';
    document.getElementById('providerBtnSupabase')?.classList.toggle('active', provider === 'supabase');
    document.getElementById('providerBtnCustom')?.classList.toggle('active', provider === 'custom');
  },

  _toggleFieldVisibility(inputId, btnId) {
    const el  = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = el.type === 'password' ? '👁' : '🙈';
  },

  _readSyncProvider() {
    const customBtn = document.getElementById('providerBtnCustom');
    if (customBtn && customBtn.classList.contains('active')) return 'custom';
    return 'supabase';
  },

  _saveSyncSettings() {
    const pass = document.getElementById('e2ePassphrase')?.value || '';
    Store.setPassphrase(pass);
    const provider = this._readSyncProvider();
    if (provider === 'supabase') {
      Store.setSyncSettings({
        provider: 'supabase',
        supabaseUrl: document.getElementById('supabaseUrl')?.value.trim() || '',
        supabaseAnonKey: document.getElementById('supabaseAnonKey')?.value || '',
        supabaseRowId: document.getElementById('supabaseRowId')?.value.trim() || 'default',
        serverUrl: Store.getSyncSettings().serverUrl,
        syncKey: Store.getSyncSettings().syncKey,
      });
    } else {
      Store.setSyncSettings({
        provider: 'custom',
        serverUrl: document.getElementById('syncServerUrl')?.value.trim() || '',
        syncKey: document.getElementById('syncKey')?.value || '',
        supabaseUrl: Store.getSyncSettings().supabaseUrl,
        supabaseAnonKey: Store.getSyncSettings().supabaseAnonKey,
        supabaseRowId: Store.getSyncSettings().supabaseRowId,
      });
    }
    const enc = Store.isEncryptionEnabled();
    if (typeof VercelAnalytics !== 'undefined') VercelAnalytics.track('sync_settings_saved', { provider, encrypted: enc });
    App.showToast(enc ? '🔐 Guardado con cifrado E2E activo' : `☁️ Sincronización con ${provider === 'supabase' ? 'Supabase' : 'servidor'} guardada`);
    this.render();
  },

  _saveSharedSettings() {
    const rowId      = document.getElementById('sharedRowId')?.value.trim() || 'compartido';
    const passphrase = document.getElementById('sharedPassphrase')?.value || '';
    // Inherit Supabase URL/key from personal sync settings
    const personal = Store.getSyncSettings();
    Store.setSharedSyncSettings({
      supabaseUrl:      personal.supabaseUrl || '',
      supabaseAnonKey:  personal.supabaseAnonKey || '',
      rowId,
      passphrase,
    });
    if (rowId && passphrase) {
      App.showToast('🤝 Espacio compartido guardado y activado');
    } else {
      App.showToast('⚠️ Introduce el ID de fila y la frase para activar el espacio compartido');
    }
    this.render();
  },

  async _testSync() {
    const pass = document.getElementById('e2ePassphrase')?.value || '';
    Store.setPassphrase(pass);
    const provider = this._readSyncProvider();
    if (provider === 'supabase') {
      Store.setSyncSettings({
        provider: 'supabase',
        supabaseUrl: document.getElementById('supabaseUrl')?.value.trim() || '',
        supabaseAnonKey: document.getElementById('supabaseAnonKey')?.value || '',
        supabaseRowId: document.getElementById('supabaseRowId')?.value.trim() || 'default',
        serverUrl: Store.getSyncSettings().serverUrl,
        syncKey: Store.getSyncSettings().syncKey,
      });
    } else {
      const url = document.getElementById('syncServerUrl')?.value.trim() || '';
      const key = document.getElementById('syncKey')?.value || '';
      Store.setSyncSettings({ provider: 'custom', serverUrl: url, syncKey: key, supabaseUrl: Store.getSyncSettings().supabaseUrl, supabaseAnonKey: Store.getSyncSettings().supabaseAnonKey, supabaseRowId: Store.getSyncSettings().supabaseRowId });
    }
    const result = await Store.testSyncConnection?.() || { ok: false, message: 'Sin método de prueba' };
    if (result.ok) App.showToast('✅ ' + result.message);
    else App.showToast('❌ ' + result.message, 4000);
    this.render();
  },

  async _forceSync() {
    App.showToast('🔄 Sincronizando…');
    await Store._syncNow();
    App.showToast(Store.getSyncStatus() === 'synced' ? '✅ Datos sincronizados' : '⚠️ ' + Store.getSyncStatusDetail(), 3500);
    this.render();
  },

  _confirmFactoryReset() {
    const hasServer = !!Store.getSyncSettings().serverUrl;
    App.openModal({
      title: '⚠️ Empezar de cero',
      body: `
        <p style="font-size:13px;color:var(--text);margin-bottom:10px;line-height:1.6">
          Esta acción <strong>eliminará todos tus datos</strong> en este dispositivo.<br>
          Se creará un backup automático en este navegador antes de borrar.
        </p>
        ${hasServer ? `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:10px;background:var(--bg);border-radius:8px;margin-bottom:10px">
          <input type="checkbox" id="resetServerCheck" style="margin-top:3px;flex-shrink:0">
          <label for="resetServerCheck" style="font-size:12px;line-height:1.5;cursor:pointer">
            También borrar los datos del servidor (<strong>${esc(Store.getSyncSettings().serverUrl)}</strong>)
          </label>
        </div>` : ''}
        <p style="font-size:12px;color:var(--expense);font-weight:600">¿Estás seguro? Esta acción no se puede deshacer.</p>`,
      actions: [
        { label: 'Cancelar' },
        { label: '🗑 Sí, borrar todo', primary: true, cb: () => this._doFactoryReset() },
      ],
    });
  },

  async _doFactoryReset() {
    const deleteServer = !!(document.getElementById('resetServerCheck')?.checked);
    App.showToast('⏳ Restableciendo…');
    await Store.factoryReset({ deleteServer });
    // Re-init con datos vacíos
    Store._ready = true;
    App._currentViewMonth = Store.getCurrentMonth();
    App._isArchived = false;
    App._renderMonthSelector();
    App._refreshAll();
    App.showToast('✅ App restablecida a cero');
    // Mostrar wizard de primera configuración
    setTimeout(() => App._showSetupWizard(), 400);
  },
};
