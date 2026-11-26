const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { patch } = require('./patch-progress-ungroup.cjs');
const source = fs.readFileSync(path.join(__dirname, '../site/bundle/app.c74e480997.js'), 'utf8');
assert.equal(patch(source), source);
assert.throws(() => patch('broken'), /Unexpected progress grouping seam/);
const start = source.indexOf('function Z(xe,Nt){return xe.length?');
const end = source.indexOf('function T(xe){const Nt=t.WEATHER', start);
assert(start >= 0 && end > start);
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + ';this.group=Z;', context);
const entries = [
  {id:1, always:false, when:new Set(['night'])},
  {id:2, always:true, when:new Set(['day'])},
  {id:3, always:false, when:new Set(['tide-high'])}
];
const result = context.group(entries, 0);
assert.equal(result.length, 1);
assert.equal(result[0].k, '');
assert.deepEqual(Array.from(result[0].list, x => x.id), [1,2,3]);
assert.equal(context.group([], 0).length, 0);
console.log('Progress encounter species use one ungrouped list.');
