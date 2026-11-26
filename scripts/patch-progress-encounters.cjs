// Empty condition lists mean an encounter has no remaining restrictions.
const fs = require('node:fs');
const path = require('node:path');
const before = 'Oa.tide?rn.when.add("tide-"+Oa.tide):Ja.when?Ja.when.forEach(je=>rn.when.add(je)):(rn.always=!0,rn.at.add(Oa.name))';
const after = 'Oa.tide?rn.when.add("tide-"+Oa.tide):Ja.when?.length?Ja.when.forEach(je=>rn.when.add(je)):(rn.always=!0,rn.at.add(Oa.name))';
function patch(source) {
  if (source.split(after).length === 2 && !source.includes(before)) return source;
  if (source.split(before).length !== 2 || source.includes(after)) throw new Error('Unexpected progress encounter seam');
  return source.replace(before, after);
}
function patchBundle() {
  const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const result = patch(source);
  if (result !== source) fs.writeFileSync(file, result);
}
if (require.main === module) patchBundle();
module.exports = { patch, patchBundle };
