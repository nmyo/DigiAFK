const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {patchLegendaryHealing} = require('./patch-legendary-healing.cjs');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
assert.equal(patchLegendaryHealing(source), source);
const rules = [
 ['if(m.kind==="static"&&m.zone&&!m.elite&&!m.raid&&!t.LegendZones.get(m.zone)?.wb)for(const ne of f.teamMons())ne.hp=f.maxHp(ne);',''],
 ['if(!m.battle)return ht().length||m.nodes[m.node]?.type==="static"&&m.nodes[m.node]?.zone&&!m.nodes[m.node]?.elite&&!m.nodes[m.node]?.raid&&!t.LegendZones.get(m.nodes[m.node].zone)?.wb||f.healTeam(),qn();','if(!m.battle)return ht().length||f.healTeam(),qn();'],
];
let original=source;
for (const [patched, old] of rules) original=original.replace(patched,old);
assert.equal(patchLegendaryHealing(original),source);
assert.throws(()=>patchLegendaryHealing(source + rules[1][0]),/Unexpected/);
assert.throws(()=>patchLegendaryHealing(source.replace(rules[1][0],'')),/Unexpected/);
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const cs=extract('function cs(m){const h=I();Object.assign(m,{turn:0','const hs=m=>');
const dispatch=extract('function qn(){const m=I(),h=m.nodes[m.node]','function Zn()');
const tick=extract('function Za(){const m=M();','const ln=()=>t.STATUS');
function run(node, {wb=false, allFainted=false, resume=false}={}) {
 const active=[{uid:'a',hp:allFainted?0:3,status:'poison',pp:[2]},{uid:'b',hp:0,status:'burn',pp:[1]}];
 const planned={uid:'c',hp:4,status:'sleep',pp:[3]};
 const state={nodes:[node],node:0,chapter:0,battle:resume?{allies:[],foes:[],queue:[]}:null};
 const f={S:{adv:state,stats:{battles:0}},teamMons:()=>active,maxHp:()=>100,curHp:m=>m.hp,healTeam:()=>{for(const x of active)x.hp=100,delete x.status;},shinyRate:()=>0,buffMult:()=>1};
 const ctx={f,I:()=>state,M:()=>state,mn:true,t:{LegendZones:{get:()=>({wb}),knobs:()=>({}),eliteKnobs:()=>({})}},a:{TEAM_SIZE:6,LEGEND_ZONE:{HP:1,POWER:1,RAGE:1}},te:(id)=>({id,hp:100}),aa:()=>1,hs:()=>({}),pn:()=>{},hn:()=>{if(resume)throw Error('existing battle reached');},ae:()=>{},bn:()=>6,ht:()=>active.filter(x=>x.hp>0)};
 ctx.cs=vm.runInNewContext('('+cs+')',ctx);ctx.qn=vm.runInNewContext('('+dispatch+')',ctx);
 const za=vm.runInNewContext('('+tick+')',ctx);
 if(resume) assert.throws(()=>za(),/existing battle reached/); else za();
 return {active,planned,state};
}
const regular={type:'static',id:144,level:10,zone:144};
for(const allFainted of [false,true]) {const r=run(regular,{allFainted}); assert.deepEqual(r.active.map(x=>x.hp),[100,100]); assert.equal(r.active[0].status,'poison');assert.equal(r.active[1].status,'burn');assert.deepEqual(r.active[0].pp,[2]);assert.equal(r.planned.hp,4);assert.equal(r.state.battle.allies.length,0);}
for(const [node,opts] of [[{...regular,elite:1},{}],[{...regular,raid:true},{}],[regular,{wb:true}],[{type:'static',id:1,level:10},{}]]) assert.deepEqual(run(node,opts).active.map(x=>x.hp),[3,0]);
assert.deepEqual(run(regular,{resume:true}).active.map(x=>x.hp),[3,0]);
// Execute the actual save routine against the mutated game state.
const saveSource=extract('function Ce(c){if(!(le||st||yt||t.TabLock?.mine()===!1))','function qe(){return v=et()');
const savedRun=run(regular); let saved;
vm.runInNewContext('('+saveSource+')()', {le:false,st:false,yt:false,t:{},Ae:0,ve:()=>{},a:{SAVE_KEY:'save'},v:{adv:savedRun.state,mons:savedRun.active},localStorage:{setItem:(key,value)=>{saved=JSON.parse(value);}}});
assert.deepEqual(saved.mons.map(x=>x.hp),[100,100]);
assert.equal(saved.adv.battle.zone,144);
console.log('Real tick, dispatcher and battle initializer: active party, fainted, exclusions and resume verified.');
