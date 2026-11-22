// Patch only the regular legendary-area HP multipliers for Articuno and Moltres.
const fs = require('node:fs');
const path = require('node:path');

const rules = [
  ['id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.74,power:1.08', 'id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.37,power:1.08'],
  ['id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:34.18,power:.24', 'id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:30.76,power:.24'],
];

function patchLegendaryDifficulty(source) {
  for (const [oldRule, newRule] of rules) {
    const oldCount = source.split(oldRule).length - 1;
    const newCount = source.split(newRule).length - 1;
    if (oldCount + newCount !== 1) throw new Error(`Unexpected legendary area rule: ${oldRule}`);
    if (oldCount === 1) source = source.replace(oldRule, newRule);
  }
  return source;
}

function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchLegendaryDifficulty(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log('Legendary area HP multipliers verified.');
}

if (require.main === module) patchBundle();
module.exports = { patchBundle, patchLegendaryDifficulty };
