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
for (const [from, to, item] of [[61,186,'kings-rock'],[79,199,'kings-rock'],[95,208,'metal-coat'],[123,212,'metal-coat'],[117,230,'dragon-scale'],[137,233,'up-grade'],[112,464,'protector'],[125,466,'electirizer'],[126,467,'magmarizer'],[356,477,'reaper-cloth'],[366,367,'deep-sea-tooth'],[366,368,'deep-sea-scale'],[349,350,'prism-scale']]) {
  const matching = evolutions[from].filter(entry => entry.to === to);
  assert.equal(matching.length, 1, `${from} -> ${to} has only its original item route`);
  assert.equal(matching[0].item, item);
}
console.log('Four link-cable evolutions require level 46; item evolutions retained.');
