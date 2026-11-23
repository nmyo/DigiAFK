// A cancelled pointer gesture must clean up without committing a drag.
const fs = require('node:fs');
const path = require('node:path');
const oldText = 'Pe(Y,()=>A(re)),le()}document.addEventListener("pointermove",B)';
const newText = 'Pe(Y,()=>{ct.type!=="pointercancel"&&A(re)}),le()}document.addEventListener("pointermove",B)';
function patchTeamInteraction(source) {
  const oldCount = source.split(oldText).length - 1;
  const newCount = source.split(newText).length - 1;
  if (newCount === 1 && oldCount === 0) return source;
  if (oldCount !== 1 || newCount !== 0) throw new Error('Unexpected team drag cancellation seam');
  return source.replace(oldText, newText);
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchTeamInteraction(source);
  if (patched !== source) fs.writeFileSync(file, patched);
}
if (require.main === module) patchBundle();
module.exports = { patchBundle, patchTeamInteraction };
