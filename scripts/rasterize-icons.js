const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('icon.svg');

async function go() {
  await sharp(svg).resize(192, 192).png().toFile('icons/icon-192.png');
  await sharp(svg).resize(512, 512).png().toFile('icons/icon-512.png');
  await sharp(svg).resize(1024, 1024).png().toFile('icons/icon-1024.png');
  await sharp(svg).resize(256, 256).png().toFile('electron/assets/appIcon.png');
  await sharp(svg).resize(512, 512).png().toFile('electron/assets/icon.png');

  const splashBg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="100%" height="100%" fill="#0F172A"/></svg>'
  );
  const icon512 = await sharp(svg).resize(900, 900).png().toBuffer();
  await sharp(splashBg)
    .composite([{ input: icon512, gravity: 'centre' }])
    .png()
    .toFile('electron/assets/splash.png');

  // Also write root favicon-sized copy
  await sharp(svg).resize(32, 32).png().toFile('icons/favicon-32.png');
  console.log('icons ok');
}

go().catch((e) => {
  console.error(e);
  process.exit(1);
});
