const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchLegendaryDifficulty } = require('./patch-legendary-difficulty.cjs');

const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const pairs = [
  ['id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.74,power:1.08', 'id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.37,power:1.08'],
  ['id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:34.18,power:.24', 'id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:30.76,power:.24'],
];
const original = pairs.reduce((s, [oldRule, newRule]) => {
  assert.equal(s.split(newRule).length - 1, 1);
  assert.equal(s.includes(oldRule), false);
  return s.replace(newRule, oldRule);
}, source);
assert.equal(patchLegendaryDifficulty(original), source, 'only the two expected substitutions');
assert.equal(patchLegendaryDifficulty(source), source, 'idempotent');
for (const [oldRule, newRule] of pairs) {
  assert.throws(() => patchLegendaryDifficulty(source.replace(newRule, 'missing')), /Unexpected legendary area rule/);
  assert.throws(() => patchLegendaryDifficulty(source + newRule), /Unexpected legendary area rule/);
  assert.throws(() => patchLegendaryDifficulty(source + oldRule), /Unexpected legendary area rule/);
}
for (const [id, name] of [[144, 'Artikodin'], [146, 'Sulfura']]) {
  assert.match(source, new RegExp(`id:${id},name:"${name}"[^}]+},captureRate:3,`));
}
console.log('Legendary difficulty patch, exact matching, idempotence and capture rates verified.');
