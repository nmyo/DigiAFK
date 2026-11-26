const assert = require('node:assert/strict');
const fs = require('node:fs');
const {changes, patchLegendaryView} = require('./patch-legendary-view.cjs');
const raw = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
assert.equal(patchLegendaryView(raw), raw);
const source = raw.replace(/\r\n/g, '\n');
assert.equal(patchLegendaryView(source), source);
assert.equal(patchLegendaryView(source.replace(/\n/g, '\r\n')), source.replace(/\n/g, '\r\n'));
const original = [...changes].reverse().reduce((s, [oldText, newText]) => {
  assert.equal(s.split(newText).length - 1, 1);
  return s.replace(newText, oldText);
}, source);
assert.equal(patchLegendaryView(original), source);
for (const [oldText, newText] of changes) {
  assert.throws(() => patchLegendaryView(source.replace(newText, 'missing')), /Unexpected legendary view seam/);
  assert.throws(() => patchLegendaryView(source + newText), /Unexpected legendary view seam/);
  assert.throws(() => patchLegendaryView(source + oldText), /Unexpected legendary view seam/);
}
const detail = source.slice(source.indexOf('function Bt(xe)'), source.indexOf('function jt(xe)'));
const normal = source.slice(source.indexOf('function jt(xe)'), source.indexOf('function jt(xe)') + 6000);
for (const section of [detail, normal]) {
  assert.match(section, /<div class="ev-hunt">/);
  assert.doesNotMatch(section, /data-lz-view|ev-board/);
  assert.match(section, /data-zone="\$\{xe.id\}"/);
  assert.match(section, /\$t\(xe/);
}
assert.match(normal, /ca\(xe\)\+\$t\(xe\)/);
assert.ok(source.includes('function ca(xe){if(!t.Cloud?.user)return"";Ct(xe.id)'));
assert.ok(source.includes('t.EventTeam.open(oa?oa.foe:ht.id'));
assert.ok(source.includes('t.Screens.adventure.goZone(+te.dataset.zone,+te.dataset.tier||0)'));
assert.ok(fs.readFileSync('scripts/build-offline.cjs', 'utf8').includes("require('./patch-legendary-view.cjs').patchBundle()"));
console.log('Legendary zone view, shared controls and exact idempotent patch verified.');
