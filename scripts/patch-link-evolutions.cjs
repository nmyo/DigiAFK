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
fs.writeFileSync(file, source);
console.log('Updated four link-cable evolutions.');
