const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patch } = require('./patch-progress-encounters.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site/bundle/app.c74e480997.js'), 'utf8');
assert.equal(patch(source), source);
assert.throws(() => patch('broken'), /Unexpected progress encounter seam/);
const start = source.indexOf('function Ee(xe){const Nt=se.CHAPTERS[xe].steps.filter');
const end = source.indexOf('function Z(xe,Nt)', start);
assert(start >= 0 && end > start);
const context = {
  se: { CHAPTERS: [{ steps: [{ kind: 'route', name: 'Route' }] }], routeBand: () => [1, 2] },
  Ve: { zonePool: () => [
    { id: 1, min: 1, max: 2, pct: 1, when: [] },
    { id: 2, min: 1, max: 2, pct: 1, when: ['night'] }
  ] }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + ';this.result=Ee(0)', context);
assert.equal(context.result[0].always, true, 'empty conditions must appear in the unconditional group');
assert.equal(context.result[1].always, false);
assert(context.result[1].when.has('night'), 'real time restrictions must remain');
console.log('Progress encounter grouping tests passed.');
