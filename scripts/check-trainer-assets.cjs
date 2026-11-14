const fs = require('fs');
const path = require('path');
const site = path.join(__dirname, '..', 'site');
const game = fs.readFileSync(path.join(site, 'bundle/app.c74e480997.js'), 'utf8');
const names = [...new Set([...game.matchAll(/sprite:"([a-z0-9-]+)"/g)].map((m) => m[1]))];
const missing = names.filter((name) => !fs.existsSync(path.join(site, 'assets/trainers', `${name}.png`)));
if (missing.length) {
  console.error(`Missing ${missing.length} trainer sprites: ${missing.join(', ')}`);
  process.exitCode = 1;
} else console.log(`All ${names.length} named trainer sprites exist.`);
