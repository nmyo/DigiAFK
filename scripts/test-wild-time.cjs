const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patch } = require('./patch-wild-time.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site/bundle/app.c74e480997.js'), 'utf8');
assert.equal(patch(source), source);
const section = source.slice(source.indexOf('function vt(m,h,ne)'), source.indexOf('const he=m=>'));
const habitat = source.slice(source.indexOf('function A(m,h,ne,Ne=null)'), source.indexOf('const $=m=>'));
let phase = 'day', weather = 'sun';
const context = { t: { WEATHER: { current: () => weather }, DAYTIME: { indoorNode: () => false, phase: () => ({key:phase}) } }, a: { WEATHER: { TYPES: { rain: {}, sun: {} } }, CONDITIONAL_WILD: { DROP: .2, OFF: 0, RULES: [{area:'route', when:['night'], only:true, add:[[8,.05]]}, {area:'route', when:['rain'], only:true, add:[[7,.05]]}] }, MAX_LEVEL:100 }, g: { regionOf: () => ({dex:[1,151]}) }, f: { PREVO:{}, DEX:{}, isLegend: () => false }, It: () => new Set(), ie: id => id, T: () => [] };
vm.createContext(context);
vm.runInContext(section + ';this.vt=vt;' + habitat + ';this.habitat=A;', context);
const node = {bg:'prairie',areas:['route'],lv:[2,5]};
let expected;
for (phase of ['morning','day','night']) for (weather of ['sun','rain']) {
  const pool = context.vt([{id:1,min:2,max:5,w:10}], node, 0);
  const entries = context.habitat({base:{1:10},night:{1:0,2:4},day:{3:5},rain:{4:6}}, node, 0);
  assert(pool.some(x => x.id === 8 && x.w > 0 && !x.off));
  assert(entries.some(x => x.id === 1 && x.w === 10));
  assert(entries.some(x => x.id === 2 && x.w === 4));
  assert(entries.some(x => x.id === 3 && x.w === 5));
  assert(entries.some(x => x.id === 4 && x.w === 6));
  const actual = JSON.stringify({pool, entries});
  if (expected === undefined) expected = actual; else assert.equal(actual, expected);
}
console.log('Wild encounters are independent of time and weather.');
