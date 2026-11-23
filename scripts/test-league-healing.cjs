const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {patchLeagueHealing} = require('./patch-league-healing.cjs');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const marker = '!Ne.event&&!Ne.zone&&!Ne.tower&&(Ne.league||g.CHAPTERS[Ne.chapter]?.league)&&f.teamMons().forEach(Xn=>Xn.hp=f.maxHp(Xn)),';
assert.equal(source.split(marker).length - 1, 1);
assert.equal(patchLeagueHealing(source), source);
assert.equal(patchLeagueHealing(source.replace(marker, '')), source);
assert.throws(() => patchLeagueHealing(source + source), /Unexpected league victory rule/);
assert.throws(() => patchLeagueHealing(source.replace(marker, 'missing,')), /Unexpected league victory rule/);
const start = source.indexOf('function Sn(m,h,ne=!1){', source.indexOf('function qn(){'));
const end = source.indexOf('const sn=()=>Object.fromEntries', start);
assert.ok(start > 0 && end > start);
const fn = source.slice(start, end);
function run(state, kind = 'trainer', remaining = false, party = [{uid:1,hp:2,max:20,status:'poison',pp:3,level:10,xp:0}, {uid:2,hp:0,max:30,status:'burn',pp:1,level:10,xp:0}]) {
  const battle = {kind, allies:[], enemies:[{id:1,level:10}], gym:{leader:'test',reward:1}, elite:state.league ? 1 : undefined};
  const adv = {chapter:0,node:0,badges:[],battle,...state};
  const f = {S:{stats:{wins:0},buddy:null},teamMons:()=>party,maxHp:m=>m.max,curHp:m=>m.hp,levelXp:()=>1,capped:()=>true,gainXp:()=>({}),buddyKo:()=>null,earn:()=>{},behindMoney:()=>1,buffMult:()=>1,tally:()=>{},regionDone:()=>false};
  let hpAtAdvance;
  const ctx = {I:()=>adv,f,g:{CHAPTERS:[{league:!!state.story}],regionOf:()=>({key:'kanto'})},a:{XP_WINS_PER_LEVEL:1,XP_BASE_REF:1,LEAGUE_TRAINERS:{xp:{},reward:1,replayMoney:1,money:1,moneyWon:1},LEADER_REPLAY_MONEY:1,TRAINER_MONEY:()=>1,MONEY_GAIN:1,COINS:{trainerChance:0}},t:{BASE_EXP:{},BadgeShine:null},se:false,oa:()=>remaining?[{}]:[],Oe:()=>{},ht:()=>party.filter(m=>m.hp>0),Jn:()=>false,Zn:()=>{hpAtAdvance=party.map(m=>m.hp); adv.node++;}};
  const result = vm.runInNewContext('('+fn+')',ctx)(battle,battle.enemies[0]);
  return {party,adv,result,hpAtAdvance};
}
for (const state of [{story:true},{league:{tier:1}}]) {
  for (const kind of ['trainer','gym']) {
    const r = run(state,kind);
    assert.deepEqual(r.party.map(m=>m.hp),[20,30]);
    assert.deepEqual(r.party.map(m=>[m.status,m.pp]),[['poison',3],['burn',1]]);
    assert.equal(r.adv.node,1);
    assert.deepEqual(r.hpAtAdvance,[20,30], 'healing precedes node advancement');
  }
}
for (const state of [{},{story:true,event:{}},{story:true,zone:{}},{story:true,tower:{}},{league:{tier:1},event:{}}]) {
  assert.deepEqual(run(state).party.map(m=>m.hp),[2,0]);
}
assert.deepEqual(run({story:true},'trainer',true).party.map(m=>m.hp),[2,0]);
// A sequence of consecutive wins heals independently after each victory.
const first = run({story:true});
first.party[0].hp = 1;
const second = run({story:true},'gym',false,first.party);
assert.deepEqual(second.party.map(m=>m.hp),[20,30]);
// Source-level checks only: these do not exercise the real Game object or save/load.
assert.ok(source.includes('xs=(c=Ka())=>c.map(qn).filter(Boolean)'));
assert.ok(source.includes('v.mons.find(C=>C.uid===c)'));
assert.ok(source.includes('Ie=c=>Math.floor(St(c).hp*ge(pt(c))*(c.hpMult||1))'));
assert.ok(source.includes('localStorage.setItem(a.SAVE_KEY,JSON.stringify(v))'));
console.log('Stubbed victory healing and source-level identity/max HP/save checks passed; actual game persistence not tested.');
