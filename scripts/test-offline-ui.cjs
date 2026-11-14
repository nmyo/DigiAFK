const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/offline-ui.js', 'utf8');
function run(initial) {
  const values = new Map(initial ? [['pokecatch-perf', initial]] : []);
  const callbacks = {};
  const context = {
    localStorage: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
    document: { addEventListener: (name, fn) => { callbacks[name] = fn; } },
    MutationObserver: class {},
  };
  vm.runInNewContext(source, context);
  return values;
}
assert.equal(JSON.parse(run().get('pokecatch-perf')).calm, true);
const custom = '{"calm":false,"weather":true}';
assert.equal(run(custom).get('pokecatch-perf'), custom);
console.log('Default eco mode and existing preferences verified.');
