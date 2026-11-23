// Heal the active road party only when a regular legendary battle starts.
const fs = require('node:fs');
const path = require('node:path');
const rules = [
  ['for(const ne of f.teamMons())delete ne.confused;pn(m)', 'if(m.kind==="static"&&m.zone&&!m.elite&&!m.raid&&!t.LegendZones.get(m.zone)?.wb)for(const ne of f.teamMons())ne.hp=f.maxHp(ne);for(const ne of f.teamMons())delete ne.confused;pn(m)'],
  ['if(!m.battle)return ht().length||f.healTeam(),qn();', 'if(!m.battle)return ht().length||m.nodes[m.node]?.type==="static"&&m.nodes[m.node]?.zone&&!m.nodes[m.node]?.elite&&!m.nodes[m.node]?.raid&&!t.LegendZones.get(m.nodes[m.node].zone)?.wb||f.healTeam(),qn();'],
];
function patchLegendaryHealing(source) {
  for (const [original, replacement] of rules) {
    // The first replacement contains the original; remove it before counting.
    const updated = source.split(replacement).length - 1;
    const remaining = source.split(replacement).join('').split(original).length - 1;
    if (updated + remaining !== 1) throw new Error('Unexpected legendary healing rule');
    if (remaining) source = source.replace(original, replacement);
  }
  return source;
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchLegendaryHealing(source);
  if (source !== patched) fs.writeFileSync(file, patched);
  console.log('Legendary healing verified.');
}
if (require.main === module) patchBundle();
module.exports = {patchLegendaryHealing, patchBundle};
