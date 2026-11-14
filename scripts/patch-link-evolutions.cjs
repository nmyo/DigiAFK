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
const oldSpeed = 'capture:{on:!0,target:"new",shiny:!0},speed:1,paused:!1';
const newSpeed = 'capture:{on:!0,target:"new",shiny:!0},speed:4,paused:!1';
if (source.includes(oldSpeed)) {
  if (source.split(oldSpeed).length !== 2) throw new Error('Ambiguous default speed');
  source = source.replace(oldSpeed, newSpeed);
} else if (!source.includes(newSpeed)) throw new Error('Default speed not found');
fs.writeFileSync(file, source);
console.log('Updated four link-cable evolutions.');
