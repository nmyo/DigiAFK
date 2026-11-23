const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchWildWeather, changes } = require('./patch-wild-weather.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site/bundle/app.c74e480997.js'), 'utf8');
assert.equal(patchWildWeather(source), source);
let original = source;
for (const [before, after] of [...changes].reverse()) original = original.replace(after, before);
assert.equal(patchWildWeather(original), source);
assert.throws(() => patchWildWeather(source.replace(changes[0][1], 'broken')));
const section = source.slice(source.indexOf('function vt(m,h,ne)'), source.indexOf('const he=m=>'));
const habitat = source.slice(source.indexOf('function A(m,h,ne,Ne=null)'), source.indexOf('const $=m=>'));
const context = { t: { WEATHER: { current: () => 'sun', encounterMult: () => 1 }, DAYTIME: { indoorNode: () => false, phase: () => ({key:'day'}) } }, a: { WEATHER: { TYPES: { rain: {}, sun: {}, storm: {} } }, CONDITIONAL_WILD: { DROP: .2, OFF: 0, RULES: [{area:'route', when:['rain'], only:true, add:[[7,.05]]}, {area:'route', when:['night'], only:true, add:[[8,.05]]}] }, MAX_LEVEL:100 }, g: { regionOf: () => ({dex:[1,151]}) }, f: { PREVO:{}, DEX:{}, isLegend: id => id === 144 }, It: () => new Set(), ie: id => id, T: () => [] };
vm.createContext(context);
vm.runInContext(section + ';this.vt=vt;' + habitat + ';this.habitat=A;', context);
const node = { bg:'prairie', areas:['route'], lv:[2,5] };
for (const weather of ['sun','rain','storm']) {
  context.t.WEATHER.current = () => weather;
  const pool = context.vt([{id:1,min:2,max:5,w:10}], node, 0);
  assert(pool.some(x => x.id === 7 && x.w > 0 && !x.off));
  assert(pool.some(x => x.id === 8 && x.off));
  const entries = context.habitat({base:{1:10,2:10},night:{2:0,3:4},rain:{4:6,1:0,144:5},storm:{4:10,5:2}}, node, 0);
  assert(entries.some(x => x.id === 4 && x.w === 10));
  assert(entries.some(x => x.id === 5 && x.w === 2));
  assert(entries.some(x => x.id === 1 && x.w === 10));
  assert(entries.some(x => x.id === 3 && x.off));
  assert(!entries.some(x => x.id === 144));
}
console.log('Wild weather pool and rebuild seam tests passed.');

// Exercise the shipped weather multipliers and configuration, not a neutral stub.
const configStart = source.indexOf('WEATHER:{SLOT_MS:');
const configEnd = source.indexOf(',NIGHT_DAMAGE:', configStart);
assert(configStart >= 0 && configEnd > configStart);
const realConfig = vm.runInNewContext('({' + source.slice(configStart, configEnd) + '})');
const multiplierStart = source.indexOf('function ve(Ee,Z){const T=S(M(Ee))');
const multiplierEnd = source.indexOf('const lt=Ee=>', multiplierStart);
assert(multiplierStart >= 0 && multiplierEnd > multiplierStart);
const realContext = {
  a: realConfig, g: { regionOf: () => ({dex:[1,251]}) },
  f: { PREVO:{}, DEX:{}, isLegend: () => false }, It: () => new Set(), ie: id => id, T: () => [],
  t: { DAYTIME: { indoorNode: () => false, phase: () => ({key:'day'}) },
    Game: { DEX: { 1:{types:['fire']}, 2:{types:['water']} } } }
};
let currentWeather = 'sun';
realContext.M = () => currentWeather;
realContext.S = key => realConfig.WEATHER.TYPES[key];
vm.createContext(realContext);
vm.runInContext(source.slice(multiplierStart, multiplierEnd) + ';this.mult=ve;' + section + ';this.vt=vt;' + habitat + ';this.habitat=A;', realContext);
realContext.t.WEATHER = { current: () => currentWeather, encounterMult: realContext.mult };
assert.notEqual(realContext.mult(node, 1), realContext.mult(node, 2));
let expected;
for (const weather of ['sun', 'rain', 'storm']) {
  currentWeather = weather;
  const input = [{id:1,min:2,max:5,w:10},{id:2,min:2,max:5,w:20}];
  const pool = realContext.vt(input, node, 0);
  const habitatEntries = realContext.habitat({base:{1:10,2:20},rain:{3:5},storm:{3:8}}, node, 0);
  const actual = JSON.stringify({pool, habitatEntries});
  if (expected === undefined) expected = actual;
  else assert.equal(actual, expected, 'encounter and area display weights must not depend on weather');
  assert.equal(pool[0].w, 10);
  assert.equal(pool[1].w, 20);
}
console.log('Real weather configuration and multiplier independence tests passed.');

const { patchEncounterPanel } = require('./patch-encounter-panel.cjs');
assert.equal(patchEncounterPanel(source), source);
assert.throws(() => patchEncounterPanel('broken'), /Unexpected encounter panel seam/);
const panel = source.slice(source.indexOf('const O=ve.zonePool(qt,z.chapter,!0,null,!0,!0)'), source.indexOf('async function Dn(o)'));
assert(!panel.includes('zone-weather'), 'encounter panel must not show weather');
assert(!panel.includes('zone-cond'), 'encounter panel must not group species by conditions');
assert(!panel.includes('zone-pct'), 'encounter panel must not show encounter percentages');
assert(panel.includes('zone-uncaught'), 'encounter panel must mark uncatalogued species');
console.log('Encounter panel displays species and uncatalogued status only.');
