const fs = require('fs');
const sharp = require('sharp');

async function main() {
  const pngToIco = (await import('png-to-ico')).default;
  const svg = fs.readFileSync('icon.svg');
  const sizes = [16, 32, 48, 64, 128, 256];
  const files = [];
  for (const s of sizes) {
    const out = `icons/icon-${s}.png`;
    await sharp(svg).resize(s, s).png().toFile(out);
    files.push(out);
  }
  const buf = await pngToIco(files);
  fs.writeFileSync('electron/assets/appIcon.ico', buf);
  fs.mkdirSync('electron/resources', { recursive: true });
  fs.writeFileSync('electron/resources/icon.ico', buf);
  console.log('ico ok', buf.length, 'bytes');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
