const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const start = source.indexOf('function Xa(N,{current:Te');
const end = source.indexOf('const Ya=()=>', start);
assert.ok(start >= 0 && end > start);
const code = source.slice(start, end);
const regions = [{key:'kanto',dex:[1,151]},{key:'johto',dex:[152,251]},{key:'hoenn',dex:[252,386]},{key:'sinnoh',dex:[387,493]}];
let current = 'kanto';
const t = { STORY: {REGIONS: regions}, FORMS: {baseOf: id => id}, EVOLUTIONS: {95:[{to:208,item:'metal-coat'}], 1:[{to:2,level:16}]} };
const g = {homeHere:()=>current,reached:()=>true,PREVO:{208:{from:95},2:{from:1}}, FAMILY_LINKS:{}, DEX:{1:{name:'A'},2:{name:'B'},95:{name:'Onix'},208:{name:'Steelix'}},S:{dex:{1:1,2:1,95:1,208:1}}};
const render = vm.runInNewContext(`(()=>{${code};return Xa})()`, {t,g,a:{TIME_EVOLUTIONS:{}}, e:x=>x,ve:x=>x,Ce:id=>`[${id}]`,Ka:()=>'',mt:()=>'',xt:()=>''});
assert.match(render(1,{detailRegion:true}), /\[1\].*\[2\]/);
assert.equal(render(95,{detailRegion:true}), '');
assert.equal(render(208,{detailRegion:true,reveal:true}), '');
current='johto';
assert.equal(render(95,{detailRegion:true}), '');
assert.equal(render(208,{detailRegion:true}), '');
for (const [region, first, last] of [['kanto',1,151],['johto',152,251],['hoenn',252,386],['sinnoh',387,493]]) {
  current = region;
  for (const id of [first, last]) {
    t.EVOLUTIONS[id] = [{to:id === first ? last : first,level:10}];
    g.DEX[id] = {name:String(id)};
  }
  // Check one internal link and both boundaries; avoid a cycle in the fixture.
  t.EVOLUTIONS[last] = [{to:last + 1,level:10}];
  g.DEX[last + 1] = {name:'outside'};
  assert.match(render(first,{detailRegion:true,reveal:true}), new RegExp(`\\[${last}\\]`));
  assert.equal(render(last,{detailRegion:true,reveal:true}), '');
}
assert.match(render(95), /\[95\].*\[208\]/, 'family renderer remains unchanged');
assert.ok(source.includes('Xa(N,{current:N,k:2,detailRegion:!0})'));
console.log('Detail evolution routes respect the active region; family renderer remains unchanged.');
