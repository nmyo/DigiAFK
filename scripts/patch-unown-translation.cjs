// Unown forms are created before localization, so share their base entry's text.
const fs = require('node:fs');
const path = require('node:path');
const old = 'Object.defineProperty(Ve,"name",U(I)),t.POKEDEX.push(Ve)';
const replacement = 'Object.defineProperty(Ve,"name",U(I)),["genus","flavor"].forEach(tt=>Object.defineProperty(Ve,tt,{get(){return ue[tt]},set(){},enumerable:!0,configurable:!0})),t.POKEDEX.push(Ve)';
function patchUnownTranslation(source) {
  if (source.includes(replacement)) return source;
  if (source.split(old).length !== 2) throw new Error('Unexpected Unown translation seam');
  return source.replace(old, replacement);
}
function patchBundle() {
  const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, patchUnownTranslation(source));
}
if (require.main === module) patchBundle();
module.exports = { patchUnownTranslation, patchBundle };
