// Patch regular legendary-area difficulty without changing other encounters.
const fs = require('node:fs');
const path = require('node:path');

const rules = [
  ['hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t}', 'hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t*(!Lt&&!h.raid&&!t.LegendZones.get(h.zone)?.wb? .25:1)}'],
  ['cs({kind:"gym",enemies:_t,trainer:Le.leader,gym:Le,sprite:Le.sprite,...Lt?{elite:Lt}:{}})', 'cs({kind:"gym",enemies:_t,trainer:Le.leader,gym:!Lt&&!m.league&&!m.event&&!m.zone&&!m.tower&&g.CHAPTERS[m.chapter]?.league?{...Le,power:(Le.power||1)*.5}:Le,sprite:Le.sprite,...!Lt&&!m.league&&!m.event&&!m.zone&&!m.tower&&g.CHAPTERS[m.chapter]?.league?{hpPower:.5}:{},...Lt?{elite:Lt}:{}})'],
  ['id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.74,power:1.08', 'id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.37,power:1.08'],
  ['id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:34.18,power:.24', 'id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:30.76,power:.24'],
  ['ne=I().battle?.rate??(h.legendary||h.mythical?a.LEGENDARY_CAPTURE_RATE:null)', 'ne=I().battle?.zone&&!I().battle.elite&&!I().battle.raid&&!t.LegendZones.get(I().battle.zone)?.wb&&(h.legendary||h.mythical)?76.5:I().battle?.rate??(h.legendary||h.mythical?a.LEGENDARY_CAPTURE_RATE:null)'],
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
  console.log('Legendary area difficulty verified.');
}

if (require.main === module) patchBundle();
module.exports = { patchBundle, patchLegendaryDifficulty };
