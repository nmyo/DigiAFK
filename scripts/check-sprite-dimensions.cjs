// The game positions Pokémon using the original 68×56 sprite canvas.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'site', 'assets', 'pokemon');
const errors = [];
let count = 0;
for (const dir of [root, path.join(root, 'shiny')]) {
  for (const name of fs.readdirSync(dir).filter((name) => /^\d+\.png$/.test(name))) {
    const file = path.join(dir, name);
    const bytes = fs.readFileSync(file);
    count++;
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.readUInt32BE(16) !== 68 || bytes.readUInt32BE(20) !== 56) {
      errors.push(path.relative(root, file));
    }
  }
}
if (errors.length) {
  console.error(`${errors.length} of ${count} sprites have incorrect dimensions: ${errors.slice(0, 8).join(', ')} …`);
  process.exitCode = 1;
} else console.log(`All ${count} Pokémon sprites are 68×56 PNGs.`);
