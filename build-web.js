/**
 * build-web.js — Copia los archivos de la PWA a la carpeta www/
 * para que Capacitor los empaquete en las apps nativas.
 *
 * Uso:
 *   node build-web.js
 *
 * Luego:
 *   npx cap sync android    → sincroniza con el proyecto Android
 *   npx cap sync ios        → sincroniza con el proyecto iOS
 *   npx cap open android    → abre Android Studio
 *   npx cap open ios        → abre Xcode (solo en Mac)
 */

const fs   = require('fs');
const path = require('path');

const SRC = __dirname;
const DST = path.join(__dirname, 'www');

// Archivos raíz a copiar
const ROOT_FILES = [
  'index.html',
  'styles.css',
  'manifest.json',
  'sw.js',
  'icon.svg',
];

// Carpetas a copiar completas
const DIRS = [
  'js',
  'icons',
];

// ────────────────────────────────────────────────────────────────────────────

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) { console.log(`  ⚠️  No encontrado: ${srcDir}`); return; }
  fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

// Limpiar www/
if (fs.existsSync(DST)) fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

console.log('📦 Construyendo www/ para Capacitor…\n');

for (const f of ROOT_FILES) {
  const src = path.join(SRC, f);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(DST, f));
    console.log(`  ✅ ${f}`);
  } else {
    console.log(`  ⚠️  No encontrado: ${f}`);
  }
}

for (const d of DIRS) {
  copyDir(path.join(SRC, d), path.join(DST, d));
  console.log(`  ✅ ${d}/`);
}

// Eliminar sw.js de www/ en apps nativas — Capacitor gestiona el caché de otra forma
// (opcional, déjalo si quieres compatibilidad PWA desde la URL del servidor también)
// const swInWww = path.join(DST, 'sw.js');
// if (fs.existsSync(swInWww)) fs.unlinkSync(swInWww);

console.log(`\n✅ www/ listo. Siguiente paso:\n`);
console.log(`   npx cap sync android   → para generar APK en Android Studio`);
console.log(`   npx cap sync ios       → para generar .app en Xcode (solo Mac)\n`);
