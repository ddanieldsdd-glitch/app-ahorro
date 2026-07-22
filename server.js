const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_KEY = process.env.SYNC_KEY || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const START_TIME = Date.now();

// ── Rate limiter básico en memoria ─────────────────────────────────────────
const _rateBuckets = new Map();
setInterval(() => _rateBuckets.clear(), 5 * 60_000);

function rateLimit(req, res, next) {
  // Solo aplica cuando hay SYNC_KEY (acceso público/remoto)
  if (!SYNC_KEY) return next();
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const now = Date.now();
  const WINDOW = 60_000;   // 1 min
  const MAX    = 120;       // requests/ventana
  let b = _rateBuckets.get(ip);
  if (!b || now - b.ts > WINDOW) { b = { count: 0, ts: now }; }
  b.count++;
  _rateBuckets.set(ip, b);
  if (b.count > MAX) return res.status(429).json({ error: 'Too many requests' });
  next();
}

// ── Auth con SYNC_KEY ────────────────────────────────────────────────────────
function checkAuth(req, res, next) {
  if (!SYNC_KEY) return next();
  if (req.headers['x-sync-key'] === SYNC_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── Helpers de disco ─────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readBlob() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return null; }
}

function writeBlob(blob) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(blob));
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(rateLimit);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Sirve los archivos estáticos de la PWA
app.use(express.static(path.join(__dirname)));

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/health', checkAuth, (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get('/api/version', (req, res) => {
  res.json({ version: START_TIME });
});

/**
 * GET /api/data
 * Devuelve el blob almacenado.
 * Si está cifrado: { ciphertext, salt, iv, version, _lastModified }
 * Si es legacy (migración): el JSON en claro tal cual
 * Si no existe: { _lastModified: 0 }
 */
app.get('/api/data', checkAuth, (req, res) => {
  const blob = readBlob();
  if (!blob) return res.json({ _lastModified: 0 });
  res.json(blob);
});

/**
 * PUT /api/data
 * Almacena el blob tal cual (cifrado o en claro).
 * El cliente es quien cifra/descifra — el servidor no toca el contenido.
 */
app.put('/api/data', checkAuth, (req, res) => {
  const blob = req.body;
  if (!blob || typeof blob !== 'object') {
    return res.status(400).json({ error: 'Invalid data' });
  }
  blob._lastModified = blob._lastModified || Date.now();
  writeBlob(blob);
  res.json({ ok: true, _lastModified: blob._lastModified });
});

/**
 * DELETE /api/data
 * Borra los datos del servidor (usado por "Empezar de cero" desde cualquier dispositivo).
 */
app.delete('/api/data', checkAuth, (req, res) => {
  try { fs.unlinkSync(DATA_FILE); } catch {}
  res.json({ ok: true });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║            APP AHORRO — Servidor activo          ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Red:     http://${ip}:${PORT}  ← usa esta URL en el móvil (WiFi)\n`);

  if (!SYNC_KEY) {
    console.log(`  ⚠️  SYNC_KEY no configurada. Cualquiera en tu red puede acceder.`);
    console.log(`     Arranca con: SYNC_KEY=tu_clave_secreta node server.js\n`);
  } else {
    console.log(`  ✅  API protegida con SYNC_KEY.\n`);
  }

  console.log(`  Los datos se almacenan en: ${DATA_FILE}`);
  console.log(`  Si los datos están cifrados, solo pueden leerse con tu frase de cifrado.\n`);
});
