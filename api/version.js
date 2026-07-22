const fs = require('fs');
const path = require('path');

/** Versión en vivo — nunca cachear (Safari/iOS PWA). */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  let cache = 'unknown';
  let builtAt = null;

  try {
    const buildIdPath = path.join(process.cwd(), 'build-id.txt');
    const text = fs.readFileSync(buildIdPath, 'utf8').trim();
    if (text) cache = text.split(/\s+/)[0];
  } catch { /* ignore */ }

  try {
    const versionPath = path.join(process.cwd(), 'version.json');
    const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    if (data.cache) cache = data.cache;
    if (data.builtAt) builtAt = data.builtAt;
  } catch { /* ignore */ }

  res.status(200).json({ cache, builtAt, source: 'api' });
};
