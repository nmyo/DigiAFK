// Apply the offline evolution rules to the bundled game.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
let source = fs.readFileSync(file, 'utf8');
for (const [from, to] of [[64, 65], [67, 68], [75, 76], [93, 94]]) {
  const oldRule = `${from}:[{to:${to},item:"link-cable"}]`;
  const newRule = `${from}:[{to:${to},level:46}]`;
  if (source.includes(newRule) && !source.includes(oldRule)) continue;
  if (source.split(oldRule).length !== 2) throw new Error(`Unexpected evolution rule for ${from}`);
  source = source.replace(oldRule, newRule);
}
// Undo previously added level alternatives; keep the original item paths.
for (const [from, to, item] of [[61,186,'kings-rock'],[79,199,'kings-rock'],[95,208,'metal-coat'],[123,212,'metal-coat'],[117,230,'dragon-scale'],[137,233,'up-grade'],[112,464,'protector'],[125,466,'electirizer'],[126,467,'magmarizer'],[356,477,'reaper-cloth'],[366,367,'deep-sea-tooth'],[366,368,'deep-sea-scale'],[349,350,'prism-scale']]) {
  const oldRule = `{to:${to},item:"${item}"}`;
  const newRule = `${oldRule},{to:${to},level:46}`;
  const tableStart = source.indexOf('t.EVOLUTIONS=');
  const tableEnd = source.indexOf(',t.', tableStart);
  if (tableStart < 0 || tableEnd < 0) throw new Error('Evolution table not found');
  let table = source.slice(tableStart, tableEnd);
  const entry = new RegExp(String.raw`(?:^|,)${from}:\[([^\]]*)\]`).exec(table);
  if (!entry) throw new Error(`Evolution entry ${from} not found`);
  const rules = entry[1];
  if (rules.split(oldRule).length !== 2) throw new Error(`Unexpected evolution rule for ${from} -> ${to}`);
  if (!rules.includes(`{to:${to},level:46}`)) continue;
  if (rules.split(newRule).length !== 2) throw new Error(`Unexpected level alternative for ${from} -> ${to}`);
  const updated = entry[0].replace(newRule, oldRule);
  table = table.slice(0, entry.index) + updated + table.slice(entry.index + entry[0].length);
  source = source.slice(0, tableStart) + table + source.slice(tableEnd);
}
const oldSpeed = 'capture:{on:!0,target:"new",shiny:!0},speed:1,paused:!1';
const newSpeed = 'capture:{on:!0,target:"new",shiny:!0},speed:4,paused:!1';
if (source.includes(oldSpeed)) {
  if (source.split(oldSpeed).length !== 2) throw new Error('Ambiguous default speed');
  source = source.replace(oldSpeed, newSpeed);
} else if (!source.includes(newSpeed)) throw new Error('Default speed not found');
fs.writeFileSync(file, source);
console.log('Updated offline trade evolutions.');
