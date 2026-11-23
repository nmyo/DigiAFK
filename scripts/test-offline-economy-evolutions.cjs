const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
function between(start, end) {
  const i = source.indexOf(start), j = source.indexOf(end, i);
  assert.ok(i >= 0 && j > i, `missing ${start}`);
  return source.slice(i, j);
}
const evolutions = vm.runInNewContext('(' + between('t.EVOLUTIONS=', ',t.').slice('t.EVOLUTIONS='.length) + ')');
const pairs = [[64,65],[67,68],[75,76],[93,94],[61,186],[79,199],[95,208],[123,212],[117,230],[137,233],[112,464],[125,466],[126,467],[356,477],[366,367],[366,368],[349,350]];
const evoCode = between('Me=c=>(t.EVOLUTIONS', 'const Ct=c=>');
const evo = vm.runInNewContext(`(()=>{const t={EVOLUTIONS:rules},a={TIME_EVOLUTIONS:{}};const ba=()=>true,Ut=()=>false,xs=()=>[];const ${evoCode};return {Me,gt}})()`, {rules:evolutions});
for (const [id,to] of pairs) {
  const mon = {id,level:45,uid:'test'};
  assert.ok(!evo.Me(mon).some(r=>r.to===to), `${id} at 45`);
  mon.level=46;
  assert.ok(evo.Me(mon).some(r=>r.to===to), `${id} at 46`);
  assert.ok(evo.gt(mon), `${id} level evolution`);
  if (![64,67,75,93].includes(id)) assert.ok(evolutions[id].some(r=>r.to===to&&r.item), `${id} item retained`);
}
// The upstream UI excludes link-cable from item evolution choices; it marks trades.
assert.ok(source.includes('g.itemEvolutions(Ke).filter(xn=>xn.item!=="link-cable")'));
assert.ok(source.includes('y.item==="link-cable"&&!Ut('));
assert.deepEqual(Array.from(evo.Me({id:366,level:46,uid:'test'}), r=>r.to), [367,368]);
assert.ok(source.includes('if(We.length>1){const Ke=await $a(') && source.includes('...We.map(Rt=>({label:'));
const priceCode = between('const Ne=c=>', 'function _a(');
const state = {money:100000, stats:{}, items:{}, adv:{}};
const candy = {id:'exp-candy-s'}, stone = {id:'fire-stone',price:100000};
const ctx = {v:state, a:{EXP_CANDIES:{'exp-candy-s':{price:1200,badges:0}},SHOP:[candy,stone],SELL:{VALUE:{},RATE:.25}}, zn:()=>1, m:()=>0, t:{}, Je:(n)=>state.money-=n, Et:(id,n)=>state.items[id]=(state.items[id]||0)+n, _:id=>state.items[id]||0, bt:n=>state.money+=n, Ce:()=>{}};
const shop = vm.runInNewContext(`(()=>{${priceCode};return {Ne,sa,Vt,La,Lt}})()`,ctx);
assert.equal(shop.Ne(candy),240); assert.equal(shop.Ne(stone),20000);
assert.ok(shop.sa(candy,10)); assert.equal(state.money,97600); assert.equal(state.items[candy.id],10);
assert.equal(shop.Vt(candy.id),60); assert.equal(shop.La(candy.id,10),600); assert.equal(state.money,98200);
assert.ok(!shop.sa(stone,10)); assert.equal(state.money,98200);
assert.ok(!shop.Lt({id:'locked',price:1,badges:1}));
ctx.zn=()=>2; assert.equal(shop.Ne(candy),480); assert.equal(shop.Vt(candy.id),120);
assert.equal(shop.Ne({id:'cheap',price:1}),1);
console.log('Real bundled evolution and shop logic passed.');
