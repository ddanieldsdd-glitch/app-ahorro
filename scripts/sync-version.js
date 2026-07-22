/**
 * Sincroniza presupuesto-vXX en todos los artefactos de versión (Vercel build + local).
 * Fuente de verdad: version.json → cache, o const CACHE en sw.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readCacheId() {
  const versionPath = path.join(ROOT, 'version.json');
  if (fs.existsSync(versionPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      if (data.cache) return data.cache;
    } catch { /* ignore */ }
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const m = sw.match(/const CACHE = '([^']+)'/);
  if (m?.[1]) return m[1];
  throw new Error('No se encontró cache id en version.json ni sw.js');
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

const cache = readCacheId();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = {
  cache,
  appVersion: pkg.version || '0.0.0',
  builtAt: new Date().toISOString(),
};

// sw.js
let sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
sw = sw.replace(/const CACHE = '[^']*'/, `const CACHE = '${cache}'`);
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);

// install.js
const installPath = path.join(ROOT, 'js', 'install.js');
let installJs = fs.readFileSync(installPath, 'utf8');
if (/const APP_BUILD_ID = '[^']*'/.test(installJs)) {
  installJs = installJs.replace(/const APP_BUILD_ID = '[^']*'/, `const APP_BUILD_ID = '${cache}'`);
} else {
  installJs = installJs.replace(/^(const WINDOWS_EXE_URL)/m, `const APP_BUILD_ID = '${cache}';\n$1`);
}
fs.writeFileSync(installPath, installJs);

// index.html — meta, inline version, query params en scripts
const indexPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/name="app-cache-version" content="[^"]*"/, `name="app-cache-version" content="${cache}"`);
html = html.replace(/window\.__APP_BUILD_VERSION='[^']*'/, `window.__APP_BUILD_VERSION='${cache}'`);
html = html.replace(/\?v=presupuesto-v[0-9]+/g, `?v=${cache}`);
fs.writeFileSync(indexPath, html);

// version files
writeJson(path.join(ROOT, 'version.json'), version);
writeJson(path.join(ROOT, 'version-check.json'), version);
fs.writeFileSync(path.join(ROOT, 'build-id.txt'), cache + '\n');

console.log(`[sync-version] OK → ${cache}`);
