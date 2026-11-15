const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
const source = fs.readFileSync(file, 'utf8');
const old = 'async function _e(){re(),pt(),t.TabLock.onLost(Q)';
const replacement = 'async function _e(){pt(),t.TabLock.onLost(Q)';
if (!source.includes(replacement)) {
  if (source.split(old).length !== 2) throw new Error('Domain interference entry not found uniquely');
  fs.writeFileSync(file, source.replace(old, replacement));
}
console.log('Domain interference disabled.');
