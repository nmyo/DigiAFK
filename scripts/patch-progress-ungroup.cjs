// Show each chapter's encounter species in one list, regardless of conditions.
const fs = require('node:fs');
const path = require('node:path');
const start = 'function Z(xe,Nt){const ea=new Set([t.DAYTIME.phase().key,';
const end = 'function T(xe){const Nt=t.WEATHER';
const replacement = 'function Z(xe,Nt){return xe.length?[{k:"",list:xe}]:[]}';
function patch(source) {
  if (source.includes(replacement)) return source;
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0 || source.indexOf(start, a + 1) !== -1) throw new Error('Unexpected progress grouping seam');
  return source.slice(0, a) + replacement + source.slice(b);
}
function patchBundle() {
  const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const result = patch(source);
  if (result !== source) fs.writeFileSync(file, result);
}
if (require.main === module) patchBundle();
module.exports = { patch, patchBundle };
