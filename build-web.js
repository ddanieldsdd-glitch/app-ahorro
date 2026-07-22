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
  'version.json',
  'build-id.txt',
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

// version.json — sincronizado con sw.js + package.json + meta en index.html
try {
  const sw = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');
  const cacheMatch = sw.match(/const CACHE = '([^']+)'/);
  const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
  const version = {
    cache: cacheMatch ? cacheMatch[1] : 'unknown',
    appVersion: pkg.version || '0.0.0',
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(SRC, 'version.json'), JSON.stringify(version, null, 2) + '\n');
  fs.writeFileSync(path.join(DST, 'version.json'), JSON.stringify(version, null, 2) + '\n');
  fs.writeFileSync(path.join(SRC, 'version-check.json'), JSON.stringify(version, null, 2) + '\n');
  fs.writeFileSync(path.join(DST, 'version-check.json'), JSON.stringify(version, null, 2) + '\n');
  fs.writeFileSync(path.join(SRC, 'build-id.txt'), version.cache + '\n');
  fs.writeFileSync(path.join(DST, 'build-id.txt'), version.cache + '\n');
  const indexPath = path.join(SRC, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.includes('name="app-cache-version"')) {
    html = html.replace(/name="app-cache-version" content="[^"]*"/, `name="app-cache-version" content="${version.cache}"`);
  } else {
    html = html.replace('</head>', `  <meta name="app-cache-version" content="${version.cache}">\n</head>`);
  }
  if (/window\.__APP_BUILD_VERSION='[^']*'/.test(html)) {
    html = html.replace(/window\.__APP_BUILD_VERSION='[^']*'/, `window.__APP_BUILD_VERSION='${version.cache}'`);
  } else {
    html = html.replace('</head>', `  <script>window.__APP_BUILD_VERSION='${version.cache}';</script>\n</head>`);
  }
  fs.writeFileSync(indexPath, html);
  copyFile(indexPath, path.join(DST, 'index.html'));
  const installPath = path.join(SRC, 'js', 'install.js');
  if (fs.existsSync(installPath)) {
    let installJs = fs.readFileSync(installPath, 'utf8');
    if (/const APP_BUILD_ID = '[^']*'/.test(installJs)) {
      installJs = installJs.replace(/const APP_BUILD_ID = '[^']*'/, `const APP_BUILD_ID = '${version.cache}'`);
    } else {
      installJs = installJs.replace(/^(const WINDOWS_EXE_URL)/m, `const APP_BUILD_ID = '${version.cache}';\n$1`);
    }
    fs.writeFileSync(installPath, installJs);
    copyFile(installPath, path.join(DST, 'js', 'install.js'));
    console.log(`  ✅ js/install.js (${version.cache})`);
  }
  console.log(`  ✅ version.json (${version.cache})`);
} catch (e) {
  console.log(`  ⚠️  version.json no generado: ${e.message}`);
}

// Eliminar sw.js de www/ en apps nativas — Capacitor gestiona el caché de otra forma
// (opcional, déjalo si quieres compatibilidad PWA desde la URL del servidor también)
// const swInWww = path.join(DST, 'sw.js');
// if (fs.existsSync(swInWww)) fs.unlinkSync(swInWww);

console.log(`\n✅ www/ listo. Siguiente paso:\n`);
console.log(`   npx cap sync android   → para generar APK en Android Studio`);
console.log(`   npx cap sync ios       → para generar .app en Xcode (solo Mac)\n`);
