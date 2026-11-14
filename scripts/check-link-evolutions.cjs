const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const start = source.indexOf('t.EVOLUTIONS=') + 't.EVOLUTIONS='.length;
const end = source.indexOf(',t.', start);
assert.ok(start >= 't.EVOLUTIONS='.length && end > start, 'evolution table found');
const evolutions = vm.runInNewContext('(' + source.slice(start, end) + ')');
for (const [from, to] of [[64, 65], [67, 68], [75, 76], [93, 94]]) {
  const rule = evolutions[from].find((entry) => entry.to === to);
  assert.equal(rule.level, 46, `${from} evolves at level 46`);
  assert.equal(rule.item, undefined, `${from} requires no item`);
  assert.equal(45 >= rule.level, false);
  assert.equal(46 >= rule.level, true);
  assert.equal(50 >= rule.level, true);
}
assert.equal(evolutions[95].find((entry) => entry.to === 208).item, 'metal-coat');
assert.equal(evolutions[61].find((entry) => entry.to === 186).item, 'kings-rock');
console.log('Four link-cable evolutions require level 46; item evolutions retained.');
