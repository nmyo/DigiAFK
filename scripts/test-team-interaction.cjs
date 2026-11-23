const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchTeamInteraction } = require('./patch-team-interaction.cjs');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
assert.equal(patchTeamInteraction(source), source, 'patch must be idempotent');
assert.throws(() => patchTeamInteraction('unexpected bundle'), /Unexpected team interaction seam/);
assert.match(source, /A\(\{src:"pc",zone:"team",uid:selected,slot\}\)/, 'new controls reuse drag commit');
assert.match(source, /H\.can\(H\.getMon\(ct\.uid\)\)/);
assert.match(source, /H\.keepOne\(re,ct\.uid\)/);
assert.match(source, /leave\(\)\{teamChoice=null/);
console.log('Team interaction patch checks passed.');
assert.match(source, /function teamChoiceCancel\(\)\{const origin=teamChoiceOrigin;teamChoice=null;teamChoiceOrigin=null;teamChoiceRender\(\);if\(origin&&origin\.isConnected&&!origin\.disabled\)origin\.focus\(\)\}/);
assert.match(source, /cancel\.onclick=teamChoiceCancel/);
assert.match(source, /re\.key==="Escape"&&teamChoice\)teamChoiceCancel\(\)/);
// Exercise cancellation with both a live virtual-list control and an evicted one.
const vm = require('node:vm');
const cancelSource = source.match(/function teamChoiceCancel\(\)\{[^}]+\}/)[0];
for (const connected of [true, false]) {
  let focused = 0, rendered = 0;
  const context = { teamChoice: 'mon', teamChoiceOrigin: { isConnected: connected, disabled: false, focus() { focused++; } }, teamChoiceRender() { rendered++; } };
  vm.runInNewContext(cancelSource + ';teamChoiceCancel()', context);
  assert.equal(focused, connected ? 1 : 0);
  assert.equal(rendered, 1);
  assert.equal(context.teamChoice, null);
  assert.equal(context.teamChoiceOrigin, null);
}
