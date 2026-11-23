// Check literal local image references in the shipped game bundles and intro player.
// Interpolated paths and scene names in data tables are not resolved by this check.
const fs = require('fs');
const path = require('path');
const site = path.join(__dirname, '..', 'site');
const files = ['bundle/app.c74e480997.js', 'bundle/app.9258c082d1.css', 'intros/legend-intros.html'];
const references = new Set();
for (const file of files) {
  const text = fs.readFileSync(path.join(site, file), 'utf8');
  for (const match of text.matchAll(/assets\/[a-zA-Z0-9_./-]+\.(?:png|gif|webp|svg|jpg)/g)) {
    references.add(match[0]);
  }
}
const missing = [...references].filter((asset) => !fs.existsSync(path.join(site, asset)));
if (missing.length) {
  console.error(`Missing ${missing.length} of ${references.size} referenced images:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`All ${references.size} literal image references exist.`);
}
