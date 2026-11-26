// Keep weather effects and non-weather availability rules; merge weather-only habitat species.
const fs = require('node:fs');
const path = require('node:path');
const changes = [
  ['if(!t.WEATHER||!m.length||(m=m.map(xa=>({...xa,w:xa.w*t.WEATHER.encounterMult(h,xa.id)})),!h?.bg))return m;', 'if(!t.WEATHER||!m.length||!h?.bg)return m;'],
  ['const la=xa.when.every(qa=>Lt.has(qa));', 'const la=xa.when.every(qa=>qa in a.WEATHER.TYPES||Lt.has(qa));'],
  ['off:!la,when:xa.when,on:la,wOn:Vt*un', 'off:!la,when:xa.when.filter(qa=>!(qa in a.WEATHER.TYPES)),on:la,wOn:Vt*un'],
  ['if(ls!=="base"&&ls!=="lv"&&ls!=="allow")for(const[gs,bs]of Object.entries(Cs))', 'if(ls!=="base"&&ls!=="lv"&&ls!=="allow"&&!(ls in a.WEATHER.TYPES))for(const[gs,bs]of Object.entries(Cs))'],
  ['for(const ls of Es)rs[ls]=0;const Fs=', 'for(const [ls,Cs] of Object.entries(m))if(ls in a.WEATHER.TYPES)for(const [gs,bs] of Object.entries(Cs))if(bs>0&&!(gs in Yn))rs[gs]=Math.max(rs[gs]||0,bs);for(const ls of Es)rs[ls]=0;const Fs='],
  ['when:Xn[ls],on:!0', 'when:Xn[ls]?.filter(Cs=>!(Cs in a.WEATHER.TYPES)),on:!0']
];
function patchWildWeather(source) {
  const timePatch = require('./patch-wild-time.cjs');
  const hasTimePatch = source.includes('let qa=la?Math.max(...la):_a;');
  if (hasTimePatch) for (const [before, after] of [...timePatch.changes].reverse()) source = source.replace(after, before);
  for (const [oldText, newText] of changes) {
    const oldCount = source.split(oldText).length - 1, newCount = source.split(newText).length - 1;
    if (newCount === 1 && oldCount === (newText.includes(oldText) ? 1 : 0)) continue;
    if (oldCount !== 1 || newCount !== (oldText.includes(newText) ? 1 : 0)) throw new Error('Unexpected wild weather seam: ' + oldText);
    source = source.replace(oldText, newText);
  }
  return hasTimePatch ? timePatch.patch(source) : source;
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8'), patched = patchWildWeather(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log('Wild weather patch verified.');
}
if (require.main === module) patchBundle();
module.exports = { patchWildWeather, patchBundle, changes };
