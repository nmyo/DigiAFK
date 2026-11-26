// Ordinary wild encounters do not depend on time of day or weather.
const fs = require('node:fs');
const path = require('node:path');
const changes = [
  ['&&!(la.night&&t.DAYTIME&&t.DAYTIME.phase().key!=="night")&&!(la.day&&t.DAYTIME&&t.DAYTIME.phase().key==="night")&&!(la.skies&&!la.skies.includes(t.WEATHER?.current(qa)))&&!(la.caught&&!la.caught.every(un=>f.S.dex[un]))', '&&!(la.caught&&!la.caught.every(un=>f.S.dex[un]))'],
  ['(De.night?u({when:["night"]}):"")+(De.day?u({when:["morning","day"]}):"")+(De.skies?u({when:De.skies}):"")+e("Nv. {n}",{n:Ve.staticLevel(W,De)})', 'e("Nv. {n}",{n:Ve.staticLevel(W,De)})'], 
  ['Mt=!ba&&(De.night&&!ot||De.day&&ot||De.skies&&!De.skies.includes(t.WEATHER?.current({name:De.name,bg:De.bg,indoor:De.indoor,climate:De.climate,ch:W})));if(!$t&&!De.needN)', 'Mt=!1;if(!$t&&!De.needN)'],
  ['(!Y.when||Y.when==="night"===Ot())&&(!Y.moon||Ot()&&v()===Y.moon)', '(!Y.moon||v()===Y.moon)'],
  ['let qa=t.DAYTIME?t.DAYTIME.weight(sa,_a,la,Lt):_a;', 'let qa=la?Math.max(...la):_a;'],
  ['const la=xa.when.every(qa=>qa in a.WEATHER.TYPES||Lt.has(qa));', 'const la=xa.when.every(qa=>qa in a.WEATHER.TYPES||["morning","day","night"].includes(qa)||Lt.has(qa));'],
  ['when:xa.when.filter(qa=>!(qa in a.WEATHER.TYPES))', 'when:xa.when.filter(qa=>!(qa in a.WEATHER.TYPES)&&!["morning","day","night"].includes(qa))'],
  ['ls!=="allow"&&!(ls in a.WEATHER.TYPES)', 'ls!=="allow"&&!(ls in a.WEATHER.TYPES)&&!["morning","day","night"].includes(ls)'],
  ['if(ls in a.WEATHER.TYPES)for(const [gs,bs]', 'if(ls in a.WEATHER.TYPES||["morning","day","night"].includes(ls))for(const [gs,bs]'],
  ['const Le=$(m),Lt=m.pool.filter(_t=>!_t.when||_t.when.some(sa=>Le.has(sa)));', 'const Le=$(m),Lt=m.pool.filter(_t=>!_t.when||_t.when.some(sa=>sa in a.WEATHER.TYPES||["morning","day","night"].includes(sa)||Le.has(sa)));'],
  ['m.pool.filter(qa=>!qa.when||qa.when.some(un=>$(m).has(un)))', 'm.pool.filter(qa=>!qa.when||qa.when.some(un=>un in a.WEATHER.TYPES||["morning","day","night"].includes(un)||$(m).has(un)))']
];
function patch(source) {
  for (const [before, after] of changes) {
    if (source.split(after).length === 2 && source.split(before).length - 1 === (after.includes(before) ? 1 : 0)) continue;
    if (source.split(before).length !== 2 || (source.includes(after) && !before.includes(after))) throw new Error('Unexpected wild time seam: ' + before);
    source = source.replace(before, after);
  }
  return source;
}
function patchBundle() {
  const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const result = patch(source);
  if (result !== source) fs.writeFileSync(file, result);
}
if (require.main === module) patchBundle();
module.exports = { patch, patchBundle, changes };
