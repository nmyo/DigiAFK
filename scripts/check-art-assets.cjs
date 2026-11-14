const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'site', 'assets', 'pokemon', 'art');
const missing = [];
let count = 0;
for (const variant of ['', 'shiny']) {
  const dir = path.join(root, variant);
  for (const file of fs.readdirSync(path.join(dir, 'still')).filter((n) => /^\d+\.png$/.test(n))) {
    count++;
    const gif = path.join(dir, file.replace(/\.png$/, '.gif'));
    if (!fs.existsSync(gif)) missing.push(path.relative(root, gif));
  }
}
if (missing.length) {
  console.error(`Missing ${missing.length} of ${count} detail animations: ${missing.slice(0, 8).join(', ')} …`);
  process.exitCode = 1;
} else console.log(`All ${count} detail animations exist.`);
