const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../site/game.js');

const name = id => G.dex[id].name;

test('all 151 Kanto entries are valid; bosses stay outside the collection', () => {
  assert.equal(Object.keys(G.dex).length, 151);
  assert.equal(G.bosses.length, 9);
  assert.equal(new Set(G.bosses.map(b => b.id)).size, 9);
  for (const form of Object.values(G.dex)) {
    for (const id of form.next) assert.ok(G.dex[id], form.name + ' → ' + id);
    assert.ok(Array.isArray(form.types) && form.types.length);
    assert.ok(form.captureRate > 0 && form.captureRate <= 255);
    assert.ok(['常见','罕见','稀有','传说'].includes(form.rarity));
  }
  for (const boss of G.bosses) assert.equal(G.dex[boss.id], undefined);
  const legends = Object.values(G.dex).filter(d => d.stage === 3);
  assert.equal(legends.length, 5, '三神鸟 + 超梦 + 梦幻');
  // 御三家两段进化链完整
  assert.deepEqual(G.dex.p001.next, ['p002']);
  assert.deepEqual(G.dex.p002.next, ['p003']);
  assert.deepEqual(G.dex.p006.next, []);
});

test('type chart: fire beats grass 2x and loses to water, boss fights stay neutral', () => {
  const s = G.create('p004', 0);
  s.mons[s.team[0]].level = 20;
  const hit = (id) => {
    s.battle = {kind:'wild', id, name:name(id), level:20, hp:9999, shiny:false, allyHp:9999};
    const message = G.step(s, () => 0, 0);
    return Number(message.match(/造成 (\d+) 伤害/)[1]);
  };
  const vsGrass = hit('p001');   // 草/毒 ← 火 2 倍
  const vsWater = hit('p007');   // 水 ← 火 0.5 倍
  assert.ok(Math.abs(vsGrass - vsWater * 4) <= 2, '2x / 0.5x 相差 4 倍（允许取整误差）');
});

test('exploration fills the team with new species and never stores duplicates', () => {
  const s = G.create('p004', 0);
  for (let i = 0; i < 600; i++) G.step(s, () => (i % 10) / 10, i * 1000);
  assert.ok(s.team.length >= 3, '第 1 条路线有 17 种宝可梦');
  const stored = [...s.team, ...s.box].map(uid => s.mons[uid]);
  const keys = stored.map(mon => mon.id + (mon.shiny ? '✦' : ''));
  assert.equal(new Set(keys).size, keys.length, '同一物种（含异色区分）不会重复入库');
  assert.ok(s.dupes > 0, '重复个体已被折算');
});

test('team changes wait for recovery; evolution keeps identity and old registration', () => {
  const s = G.create('p004', 0);
  s.mons.r1 = {id:'p007',level:5,xp:0,shiny:false};
  s.box.push('r1');
  const uid = s.team[0], reserve = 'r1';
  assert.ok(G.queueSwap(s, uid, reserve));
  assert.equal(s.team[0], uid);
  G.recover(s);
  assert.equal(s.team[0], reserve);
  s.mons[uid].level = 16;
  assert.ok(G.evolve(s, uid, 'p005'));
  assert.equal(s.mons[uid].id, 'p005');
  assert.ok(s.seen.includes('p004'), '进化前形态仍登记在图鉴');
});

test('main bosses unlock in order and terminal victory survives save and restore', () => {
  const s = G.create('p004', 0);
  assert.equal(G.challenge(s, 'gym9'), false);
  for (let i = 0; i < G.bosses.length; i++) {
    s.mons[s.team[0]].level = 100;
    s.routeWins[i] = 3;
    assert.ok(G.challenge(s, G.bosses[i].id));
    for (let j = 0; j < 60 && s.battle; j++) G.step(s, () => 0, 0);
    assert.equal(s.cleared.length, i + 1);
  }
  assert.equal(G.load(G.serialize(s)).cleared.at(-1), 'gym9');
});

test('shop, breeding and offline rewards respect prerequisites and pay once', () => {
  const s = G.create('p004', 1000);
  assert.equal(G.buy(s, 'evolution-chip'), false);
  s.coins = 100;
  assert.ok(G.buy(s, 'ration'));
  assert.equal(s.coins, 85);
  for (let i = 0; i < 100; i++) G.step(s, () => 0, 1000);
  const now = 20 * 3600000;
  const report = G.offline(s, now);
  assert.ok(report.rounds > 0, 'offline simulates the closed period');
  assert.ok(report.elapsed >= 19 * 3600000);
  assert.equal(G.offline(s, now).rounds, 0, 'reopening twice pays nothing extra');
  assert.equal(G.offline(s, now - 1).rounds, 0, 'clock rollback pays nothing');
  assert.equal(G.load('{broken'), null);
});

test('breeding needs a ditto, pays its egg exactly once and keeps it when storage is full', () => {
  const s = G.create('p004', 1000);
  s.mons.r1 = {id:'p007',level:5,xp:0,shiny:false};
  s.box.push('r1');
  assert.equal(G.board(s, 'r1', 1000), true);
  assert.equal(s.egg, null, '没有百变怪不会产蛋，只提供经验加成');
  s.mons.r2 = {id:'p132',level:5,xp:0,shiny:false};
  s.box.push('r2');
  s.egg = null;
  // 取回再寄放，触发产蛋判定
  assert.ok(G.takeBack(s));
  assert.ok(G.board(s, 'r1', 1000));
  assert.equal(s.egg.id, 'p001', '同路线的基础形态作为蛋');
  assert.equal(G.claimEgg(s, 1001), false, 'egg is not ready');
  const ready = s.egg.at;
  assert.ok(G.claimEgg(s, ready));
  assert.equal(s.hatched, 1);
  assert.equal(G.claimEgg(s, ready), false, 'egg pays once');
  // 4 个寄放位
  const multi = G.create('p004', 0);
  for (let i = 0; i < 4; i++) {
    const uid='b'+i;
    multi.mons[uid] = {id:'p007',level:5,xp:0,shiny:false};
    multi.box.push(uid);
    assert.ok(G.board(multi, uid, 0));
  }
  multi.mons.b4 = {id:'p007',level:5,xp:0,shiny:false};
  multi.box.push('b4');
  assert.equal(G.board(multi, 'b4', 0), false, '培育屋只有 4 个寄放位');
  assert.equal(multi.board.length, G.boardMax);
  const full = G.create('p004', 0);
  full.mons.ditto = {id:'p132',level:5,xp:0,shiny:false}; full.team.push('ditto');
  for (let i = 1; i < 5; i++) { full.mons['t'+i] = {id:'p004',level:5,xp:0,shiny:false}; full.team.push('t'+i); }
  full.mons.r1 = {id:'p007',level:5,xp:0,shiny:false}; full.box.push('r1');
  for (let i = 0; i < G.boxMax - 1; i++) { full.mons['x'+i] = {id:'p007',level:2,xp:0,shiny:false}; full.box.push('x'+i); }
  assert.equal(full.box.length, G.boxMax);
  assert.ok(G.board(full, 'r1', 0));
  full.mons.refill = {id:'p010',level:2,xp:0,shiny:false}; full.box.push('refill');
  assert.equal(full.box.length, G.boxMax, 'storage refills while breeding');
  assert.equal(G.claimEgg(full, full.egg.at), false, 'no room to hatch');
  full.box.pop();
  assert.ok(G.claimEgg(full, full.egg.at));
});

test('shop sells items back at half price and training buys experience', () => {
  const s = G.create('p004', 100);
  s.coins = 100;
  assert.ok(G.buy(s, 'ration'));
  assert.equal(s.coins, 85);
  assert.ok(G.sell(s, 'ration'));
  assert.equal(s.coins, 92, '半价回收 7 金币');
  assert.equal(G.sell(s, 'ration'), false, '没有道具不可卖');
  const uid = s.team[0];
  s.coins = 1000;
  const level = s.mons[uid].level, xp = s.mons[uid].xp;
  assert.ok(G.trainSession(s, uid));
  assert.ok(s.coins < 1000, '训练收费');
  assert.ok(s.mons[uid].xp > xp || s.mons[uid].level > level, '训练加经验');
  assert.equal(G.trainSession(s, 'nope'), false);
});

test('weather helper and single-player achievements derive from the save', () => {
  assert.deepEqual(G.weather(0), {night:false, rain:false}, 'UTC 0 点 = 本地白天');
  assert.equal(G.weather(3600000*14).night, true, 'UTC 14 点 = 本地 22 点夜间');
  const s = G.create('p004', 0);
  assert.ok(G.achieved(s).includes('start'), '开局即解锁冒险启程');
  assert.ok(!G.achieved(s).includes('catch10'));
  s.stats.catches = 10;
  assert.ok(G.achieved(s).includes('catch10'));
  s.cleared = G.bosses.map(b=>b.id);
  s.seen = Object.keys(G.dex);
  assert.ok(G.achieved(s).includes('champion'));
  assert.ok(G.achieved(s).includes('dex151'));
});

test('single-player activities gate entry, support retry and persist rewards', () => {
  const s = G.create('p004', 0);
  for (const id of ['raid','legend','tower','underground','casino'])
    assert.equal(G.activity(s, id, () => 0).ok, false);
  s.cleared = G.bosses.slice(0,4).map(b => b.id);
  s.coins = 100;
  s.mons[s.team[0]].level = 100;
  for (const id of ['raid','legend','tower']) {
    assert.ok(G.activity(s, id, () => 0).ok);
    for (let i = 0; i < 60 && s.battle; i++) G.step(s, () => 0, 0);
    assert.equal(s.records[id], 1);
  }
  for (let i = 0; i < 100; i++) G.step(s, () => 0, 0);
  G.recover(s);
  for (const id of ['underground','casino']) assert.ok(G.activity(s,id,()=>0).ok);
  assert.equal(G.load(G.serialize(s)).records.tower, 1);
});

test('a fully wiped party can retry, and evolution follows the real evolution chain', () => {
  const s = G.create('p004', 0);
  s.routeWins[0] = 3;
  assert.ok(G.challenge(s,'gym1'));
  s.battle.allyHp = 1;
  assert.match(G.step(s,()=>0,0), /败退/);
  assert.ok(G.challenge(s,'gym1'));
  G.recover(s);
  const uid=s.team[0];
  s.mons[uid].level = 15;
  assert.equal(G.evolve(s,uid,'p005'), false, 'Lv.15 不够进化');
  s.mons[uid].level = 16;
  assert.ok(G.evolve(s,uid,'p005'), '小火龙 → 火恐龙');
  assert.equal(G.evolve(s,uid,'p006'), false, 'Lv.32 之前无法跳段');
  s.mons[uid].level = 32;
  assert.ok(G.evolve(s,uid,'p006'), '火恐龙 → 喷火龙');
  assert.equal(G.evolve(s,uid,'p006'), false, '最终形态没有后续进化');
  // 传说没有 next，任何等级都不可进化
  s.mons.r2 = {id:'p150',level:100,xp:0,shiny:false};
  assert.deepEqual(G.dex.p150.next, []);
});

test('each starter can beat all 9 gyms using only legal progression actions', () => {
  for (const id of G.starters) {
    const s = G.create(id,0);
    assert.equal(G.travel(s,8),false);
    for (let i=0;i<G.bosses.length;i++) {
      assert.ok(G.travel(s,i));
      for (let j=0;j<600&&s.cleared.length===i;j++) {
        if (!s.battle&&s.routeWins[i]>=3) G.challenge(s,G.bosses[i].id);
        G.step(s,()=>0.25,0);
      }
      assert.equal(s.cleared[i],G.bosses[i].id,name(id));
    }
  }
});

test('no trade activity exists and evolutions are gated by level only', () => {
  const s = G.create('p004',0);
  assert.equal(G.activities.trade, undefined);
  assert.equal(G.activity(s,'trade',()=>0).ok, false);
  s.mons[s.team[0]].level = 16;
  assert.ok(G.evolve(s,s.team[0],'p005'));
  s.mons[s.team[0]].level = 32;
  assert.ok(G.evolve(s,s.team[0],'p006'));
});

test('duplicate captures convert into coins and team experience instead of storage', () => {
  const s = G.create('p004', 0);
  const coins = s.coins, level = s.mons[s.team[0]].level;
  let last = '';
  for (let i = 0; i < 200; i++) {
    const message = G.step(s, () => 0, 0);
    if (message.includes('已转化为')) last = message;
  }
  assert.ok(s.dupes > 0, 'duplicates are counted');
  assert.ok(s.coins > coins, 'duplicates pay coins');
  assert.ok(s.mons[s.team[0]].level > level, 'duplicates feed team experience');
  assert.match(last, /已转化为/);
  assert.deepEqual(s.bag, {}, 'no item is consumed');
});

test('a shiny duplicate is still collected when no shiny is owned', () => {
  const s = G.create('p004', 0);
  s.mons[s.team[0]].level = 100;
  s.battle = {kind:'wild',id:'p004',name:'小火龙',level:5,hp:1,shiny:true,allyHp:100};
  G.step(s, () => 0, 0);
  assert.equal(s.team.length, 2);
  assert.equal(s.mons[s.team[1]].shiny, true);
  s.battle = {kind:'wild',id:'p004',name:'小火龙',level:5,hp:1,shiny:true,allyHp:100};
  G.step(s, () => 0, 0);
  assert.equal(s.team.length, 2, '已有异色后再遇同种异色按重复折算');
});

test('a full storage converts new species instead of dropping them, and release frees space', () => {
  const s = G.create('p004', 0);
  for (let i = 1; i < 6; i++) { s.mons['t'+i] = {id:'p004',level:5,xp:0,shiny:false}; s.team.push('t'+i); }
  for (let i = 0; i < G.boxMax; i++) {
    const uid = 'x' + i;
    s.mons[uid] = {id:'p007',level:2,xp:0,shiny:false};
    s.box.push(uid);
  }
  s.battle = {kind:'wild',id:'p001',name:'妙蛙种子',level:5,hp:1,shiny:false,allyHp:100};
  const coins = s.coins;
  const message = G.step(s, () => 0, 0);
  assert.match(message, /仓库已满/);
  assert.equal(s.box.length, G.boxMax);
  assert.ok(s.coins > coins, 'the missed capture still pays coins');
  assert.equal(G.release(s, s.team[0]), false, 'team members cannot be released');
  assert.ok(G.release(s, s.box[0]));
  assert.equal(s.box.length, G.boxMax - 1);
});

test('chunked settlement matches the synchronous result exactly', () => {
  const a = G.create('p004', 0), b = G.create('p004', 0);
  const single = G.offline(a, 3 * 3600000);
  const iterator = G.offlineSteps(b, 3 * 3600000, 500);
  let step = iterator.next(), chunks = 0;
  while (!step.done) { chunks++; step = iterator.next(); }
  assert.ok(chunks > 10, 'large settlements are split into many chunks');
  assert.equal(JSON.stringify(a), JSON.stringify(b), '分块不改变结算结果');
  assert.equal(step.value.coins, single.coins);
  assert.equal(step.value.catches, single.catches);
});

test('a very long absence is capped at 72 hours and reported as truncated', () => {
  const s = G.create('p004', 0);
  const report = G.offline(s, 60 * 24 * 3600000);
  assert.ok(report.truncated, '显示为已截断');
  assert.equal(report.rounds, Math.floor(72 * 3600000 / 1100), '72 小时对应的回合数');
});

test('closed-page offline run progresses battles, captures and coins deterministically', () => {
  const a = G.create('p004', 0), b = G.create('p004', 0);
  const ra = G.offline(a, 6 * 3600000), rb = G.offline(b, 6 * 3600000);
  assert.ok(ra.rounds > 1000, 'hours away become simulated rounds');
  assert.ok(ra.coins > 0, 'captures and wins pay coins');
  assert.ok(ra.catches > 0, 'wild wins are captured offline');
  assert.ok(a.mons[a.team[0]].level > 5, 'the party keeps gaining levels offline');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const restored = G.load(G.serialize(a));
  assert.equal(restored.team[0], a.team[0]);
  assert.equal(restored.coins, a.coins);
});

test('casino slots pay tokens, pachinko spends tokens, and locked wagers charge nothing', () => {
  const s = G.create('p004',0);
  assert.equal(G.casino(s,'slots',()=>0).ok,false);
  assert.equal(s.coins,3000);
  s.cleared=G.bosses.slice(0,2).map(b=>b.id);
  assert.equal(G.casino(s,'pachinko',()=>0).ok,false);
  const spin=G.casino(s,'slots',()=>0);
  assert.equal(spin.lines.length,5);
  assert.equal(s.coins,2990);
  assert.ok(s.bag.token>=2);
  const tokens=s.bag.token;
  assert.ok(G.casino(s,'pachinko',()=>0).ok);
  assert.equal(s.bag.token,tokens-2);
  assert.equal(s.bag.ration,1);
});

test('encounter pool respects route and weather: legends only at night+rain on late routes', () => {
  const s = G.create('p004', 0);
  // 路线选择：华蓝洞窟（index 8）
  s.cleared = G.bosses.map(b => b.id);
  assert.ok(G.travel(s, 8));
  const dayPool = [], nightRainPool = [];
  for (let i = 0; i < 400; i++) {
    s.battle = null;
    G.step(s, Math.random, 3600000*0 + i*1100);        // UTC 0 点 = 本地 8 点，白天无雨
    if (s.battle) dayPool.push(G.dex[s.battle.id].stage);
    s.battle = null;
    G.step(s, Math.random, 3600000*14 + i*1100);       // UTC 14 点 = 本地 22 点，夜间雨天
    if (s.battle) nightRainPool.push(G.dex[s.battle.id].stage);
  }
  assert.ok(!dayPool.includes(3), '白天不出传说');
  assert.ok(dayPool.includes(0) || dayPool.includes(1), '白天出基础与一阶');
  assert.ok(!dayPool.includes(2), '最终形态白天（无雨）不出');
  assert.ok(nightRainPool.includes(3), '夜间雨天出传说');
});
