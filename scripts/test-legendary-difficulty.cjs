const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchLegendaryDifficulty } = require('./patch-legendary-difficulty.cjs');

const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const pairs = [
  ['hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t}', 'hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t*(!Lt&&!h.raid&&!t.LegendZones.get(h.zone)?.wb? .1:1)}'],
  ['power:(sa.power??a.LEGEND_ZONE.POWER)*_t**2,', 'power:(sa.power??a.LEGEND_ZONE.POWER)*_t**2*(!Lt&&!h.raid&&!t.LegendZones.get(h.zone)?.wb? .25:1),'],
  ['cs({kind:"gym",enemies:_t,trainer:Le.leader,gym:Le,sprite:Le.sprite,...Lt?{elite:Lt}:{}})', 'cs({kind:"gym",enemies:_t,trainer:Le.leader,gym:!Lt&&!m.league&&!m.event&&!m.zone&&!m.tower&&g.CHAPTERS[m.chapter]?.league?{...Le,power:(Le.power||1)*.5}:Le,sprite:Le.sprite,...!Lt&&!m.league&&!m.event&&!m.zone&&!m.tower&&g.CHAPTERS[m.chapter]?.league?{hpPower:.5}:{},...Lt?{elite:Lt}:{}})'],
  ['id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.74,power:1.08', 'id:144,weather:"snow",arena:"artikodin-mer-gelee",hp:3.37,power:1.08'],
  ['id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:34.18,power:.24', 'id:146,weather:"ash",arena:"sulfura-grotte-ardente",hp:30.76,power:.24'],
  ['return Math.min(a.CAPTURE_MAX*Le,Ne*Le)}const Ca=', 'return Math.min((I().battle?.zone&&!I().battle.elite&&!I().battle.raid&&!t.LegendZones.get(I().battle.zone)?.wb&&(h.legendary||h.mythical)? .9:a.CAPTURE_MAX)*Le,Ne*Le)}const Ca='],
  ['ne=I().battle?.rate??(h.legendary||h.mythical?a.LEGENDARY_CAPTURE_RATE:null)', 'ne=I().battle?.zone&&!I().battle.elite&&!I().battle.raid&&!t.LegendZones.get(I().battle.zone)?.wb&&(h.legendary||h.mythical)?229.5:I().battle?.rate??(h.legendary||h.mythical?a.LEGENDARY_CAPTURE_RATE:null)'],
];
const original = pairs.reduce((s, [oldRule, newRule]) => {
  assert.equal(s.split(newRule).length - 1, 1);
  assert.equal(s.includes(oldRule), false);
  return s.replace(newRule, oldRule);
}, source);
assert.equal(patchLegendaryDifficulty(original), source, 'only the expected substitutions');
assert.equal(patchLegendaryDifficulty(source), source, 'idempotent');
const previous = source.replace('hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t*(!Lt&&!h.raid&&!t.LegendZones.get(h.zone)?.wb? .1:1)}', 'hpPower:(sa.hp??a.LEGEND_ZONE.HP)*_t*(!Lt&&!h.raid&&!t.LegendZones.get(h.zone)?.wb? .25:1)}').replace(pairs[1][1], pairs[1][0]);
assert.equal(patchLegendaryDifficulty(previous), source, 'upgrade previous patch');
for (const [oldRule, newRule] of pairs) {
  assert.throws(() => patchLegendaryDifficulty(source.replace(newRule, 'missing')), /Unexpected legendary area rule/);
  assert.throws(() => patchLegendaryDifficulty(source + newRule), /Unexpected legendary area rule/);
  assert.throws(() => patchLegendaryDifficulty(source + oldRule), /Unexpected legendary area rule/);
}
for (const [id, name] of [[144, 'Artikodin'], [146, 'Sulfura']]) {
  assert.match(source, new RegExp(`id:${id},name:"${name}"[^}]+},captureRate:3,`));
}
console.log('Legendary difficulty patch, exact matching, idempotence and capture rates verified.');

// Execute the actual bundled capture probability function with representative battle state.
const vm = require('node:vm');
const start = source.indexOf('function pa(m){');
const match = start < 0 ? null : [source.slice(start, source.indexOf('}const Ca=', start) + 1)];
assert.ok(match);
function probability(battle, mon, wb = false) {
  return vm.runInNewContext('(' + match[0] + ')({mon:{id:1}})', {
    I: () => ({battle}), f: {DEX: {1: mon}, buffMult: () => 1},
    a: {LEGENDARY_CAPTURE_RATE: 3, CAPTURE_BONUS: .6, CAPTURE_MAX: .6},
    t: {LegendZones: {get: () => ({wb})}},
  });
}
const legend = {legendary:true, captureRate:3};
assert.equal(probability({zone:144}, legend), .9);
assert.equal(probability({zone:144, elite:1}, legend), 3/255);
assert.equal(probability({zone:144, raid:true, rate:10}, legend), 10/255);
assert.equal(probability({zone:144}, legend, true), 3/255);
assert.equal(probability({}, legend), 3/255);
assert.equal(probability({zone:144}, {captureRate:45}), 45*.6/255);
assert.ok(source.includes('zone:h.zone,edge:Ne,...Lt?{elite:Lt}'));
assert.ok(source.includes('qa=m.zone&&t.LegendZones.get(m.zone)?.wb?{prob:a.WORLDBOSS.CATCH}'));

// Exercise the real encounter dispatcher and HP initializer, not a copied formula.
const dispatcher = source.slice(source.indexOf('function qn(){'), source.indexOf('function Zn()', source.indexOf('function qn(){')));
const pn = source.slice(source.indexOf('function pn(m){'), source.indexOf('function Bn(', source.indexOf('function pn(m){')));
const damage = source.match(/const kn=m=>m\.kind==="gym"\?[^;]+;/)[0];
function encounter(node, state = {}, wb = false) {
  const m = {nodes:[node], node:0, chapter:0, ...state};
  const a = {TEAM_SIZE:6, GYM_HP_MULT:1.3, GYM_TEAM_EXP:1, ENEMY_HP_PER_ALLY:0, GYM_DAMAGE:1.3, ENEMY_DAMAGE:{}, LEGEND_ZONE:{HP:8, POWER:2, RAGE:10}};
  const g = {CHAPTERS:[{league:state.storyLeague !== false}], gymTeam:()=>[[1,10]], leagueOf:()=>true, regionOf:()=>({}), MEW_CHANCE:0};
  const t = {Events:{isOpen:()=>true}, LegendZones:{over:()=>false, get:()=>({wb}), knobs:()=>({hp:8,power:2}), eliteKnobs:()=>({hp:8,power:2})}};
  const f = {teamMons:()=>[], shinyRate:()=>0, buffMult:()=>1, maxHp:x=>Math.floor(100*x.hpMult)};
  const ctx = {I:()=>m, a,g,t,f, te:(id,level)=>({id,level}), aa:()=>2, hs:()=>({}), mn:false,
    K:()=>[], Ae:()=>[], le:()=>({id:1,level:10}), Z:id=>id, bt:id=>id,
    cs:b=>{b.slots=1; ctx.init(b); m.battle=b;}};
  ctx.init=vm.runInNewContext('('+pn+')', {...ctx, oa:b=>b.enemies});
  ctx.damage=vm.runInNewContext(damage+'kn',ctx);
  vm.runInNewContext('('+dispatcher+')()',ctx);
  return {battle:m.battle, damage:ctx.damage(m.battle)};
}
const gym = {type:'gym', gym:{leader:'leader',power:2,badge:'badge',keep:true}};
const story = encounter(gym);
assert.equal(story.battle.enemies[0].hp, 390);
assert.equal(story.battle.enemies[0].hp / encounter(gym, {storyLeague:false}).battle.enemies[0].hp, .25);
assert.equal(story.damage, 1.3);
assert.equal(story.battle.gym.badge, 'badge');
assert.equal(story.battle.gym.keep, true);
assert.equal(gym.gym.power, 2);
for (const state of [{league:true},{tower:{}},{event:{}},{zone:{}},{storyLeague:false}]) {
  const b=encounter(gym,state); assert.equal(b.battle.enemies[0].hp,1560); assert.equal(b.damage,2.6);
}
const eliteGym=encounter({...gym, leagueElite:1, team:[[1,10]]});
assert.equal(eliteGym.battle.enemies[0].hp,1560);
const staticNode={type:'static',id:1,level:10,zone:144};
assert.equal(encounter(staticNode).battle.enemies[0].hp,160);
assert.equal(encounter(staticNode).damage,2);
assert.equal(encounter({...staticNode,elite:1}).battle.enemies[0].hp,800);
assert.equal(encounter({...staticNode,elite:1}).damage,2);
assert.equal(encounter({...staticNode,raid:true}).battle.enemies[0].hp,1600);
assert.equal(encounter({...staticNode,raid:true}).damage,8);
assert.equal(encounter(staticNode,{},true).battle.enemies[0].hp,1600);
assert.equal(encounter(staticNode,{},true).damage,8);
assert.equal(encounter({type:'static',id:1,level:10}).battle.enemies[0].hp,100);
assert.equal(encounter({type:'wild'}).battle.enemies[0].hp,100);
// Actual aura uses average team strength (not party count alone); six unranked
// level-90 allies produce aura 1. A full-slot battle has the 4.5 HP factor.
const auraSource = source.slice(source.indexOf('function aa(m){'), source.indexOf('function te(', source.indexOf('function aa(m){')));
const aura = vm.runInNewContext('(' + auraSource + ')', {
  a:{LEGEND_ZONE:{AURA:1}, MAX_LEVEL:100, UNDERGROUND:{RANK_STAT:1}},
  f:{rankOf:()=>0},
});
assert.equal(aura(Array.from({length:6}, () => ({level:90}))), 1);
assert.ok(source.includes('ENEMY_HP_PER_ALLY:.7'));
assert.ok(source.includes('TEAM_SIZE:6'));
// With the real initializer and actual full-slot multiplier, compare both paths.
const init = vm.runInNewContext('(' + pn + ')', {
  a:{TEAM_SIZE:6, ENEMY_HP_PER_ALLY:.7}, oa:b=>b.enemies,
  f:{maxHp:x=>Math.floor(100*x.hpMult)},
});
const fullParty = {kind:'static', slots:6, hpPower:8*.1, enemies:[{}]};
init(fullParty);
assert.equal(fullParty.enemies[0].hp, 360);
console.log('Encounter dispatcher, story gym HP/damage and legendary exclusions verified.');
