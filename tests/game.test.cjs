const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../site/game.js');

test('all 70 forms have valid evolution targets; bosses are outside the collection', () => {
  assert.equal(Object.keys(G.dex).length, 70);
  assert.equal(new Set(G.bosses.map(b => b.id)).size, 5);
  for (const form of Object.values(G.dex))
    for (const id of form.next) assert.ok(G.dex[id]);
  for (const boss of G.bosses) assert.equal(G.dex[boss.id], undefined);
});

test('exploration fills the team with new species and never stores duplicates', () => {
  const s = G.create('agumon', 0);
  for (let i = 0; i < 600; i++) G.step(s, () => (i % 10) / 10, i * 1000);
  assert.ok(s.team.length >= 3, '第 1 版本地区只有少量成长期物种');
  const stored = [...s.team, ...s.box].map(uid => s.mons[uid]);
  const keys = stored.map(mon => mon.id + (mon.shiny ? '✦' : ''));
  assert.equal(new Set(keys).size, keys.length, '同一物种（含异色区分）不会重复入库');
  assert.ok(s.dupes > 0, '重复个体已被折算');
});

test('team changes wait for recovery; evolution keeps identity and old registration', () => {
  const s = G.create('agumon', 0);
  s.mons.r1 = {id:'betamon',level:5,xp:0,shiny:false};
  s.box.push('r1');
  const uid = s.team[0], reserve = 'r1';
  assert.ok(G.queueSwap(s, uid, reserve));
  assert.equal(s.team[0], uid);
  G.recover(s);
  assert.equal(s.team[0], reserve);
  s.mons[uid].level = 15;
  assert.ok(G.evolve(s, uid, 'greymon'));
  assert.equal(s.mons[uid].id, 'greymon');
  assert.ok(s.seen.includes('agumon'));
});

test('main bosses unlock in order and terminal victory survives save and restore', () => {
  const s = G.create('agumon', 0);
  assert.equal(G.challenge(s, 'apocalymon'), false);
  for (let i = 0; i < G.bosses.length; i++) {
    s.mons[s.team[0]].level = 100;
    s.routeWins[i] = 3;
    assert.ok(G.challenge(s, G.bosses[i].id));
    for (let j = 0; j < 30 && s.battle; j++) G.step(s, () => 0, 0);
    assert.equal(s.cleared.length, i + 1);
  }
  assert.equal(G.load(G.serialize(s)).cleared.at(-1), 'apocalymon');
});

test('shop, breeding and offline rewards respect prerequisites and pay once', () => {
  const s = G.create('agumon', 1000);
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

test('breeding pays its egg exactly once and keeps it when storage is full', () => {
  const s = G.create('agumon', 1000);
  s.mons.r1 = {id:'betamon',level:5,xp:0,shiny:false};
  s.box.push('r1');
  assert.ok(G.board(s, 'r1', 1000));
  assert.equal(G.claimEgg(s, 1001), false, 'egg is not ready');
  const ready = s.egg.at;
  assert.ok(G.claimEgg(s, ready));
  assert.equal(G.claimEgg(s, ready), false, 'egg pays once');
  // 仓库满时保留孵化结果，腾出空位后仍可领取
  const full = G.create('agumon', 0);
  for (let i = 1; i < 6; i++) { full.mons['t'+i] = {id:'agumon',level:5,xp:0,shiny:false}; full.team.push('t'+i); }
  full.mons.r1 = {id:'betamon',level:5,xp:0,shiny:false}; full.box.push('r1');
  for (let i = 0; i < G.boxMax - 1; i++) { full.mons['x'+i] = {id:'betamon',level:2,xp:0,shiny:false}; full.box.push('x'+i); }
  assert.equal(full.box.length, G.boxMax);
  assert.ok(G.board(full, 'r1', 0));
  full.mons.refill = {id:'patamon',level:2,xp:0,shiny:false}; full.box.push('refill');
  assert.equal(full.box.length, G.boxMax, 'storage refills while breeding');
  assert.equal(G.claimEgg(full, full.egg.at), false, 'no room to hatch');
  full.box.pop();
  assert.ok(G.claimEgg(full, full.egg.at));
});

test('single-player activities gate entry, support retry and persist rewards', () => {
  const s = G.create('agumon', 0);
  for (const id of ['raid','legend','tower','underground','casino'])
    assert.equal(G.activity(s, id, () => 0).ok, false);
  s.cleared = G.bosses.slice(0,4).map(b => b.id);
  s.coins = 100;
  s.mons[s.team[0]].level = 100;
  for (const id of ['raid','legend','tower']) {
    assert.ok(G.activity(s, id, () => 0).ok);
    for (let i = 0; i < 30 && s.battle; i++) G.step(s, () => 0, 0);
    assert.equal(s.records[id], 1);
  }
  for (let i = 0; i < 100; i++) G.step(s, () => 0, 0);
  G.recover(s);
  for (const id of ['underground','casino']) assert.ok(G.activity(s,id,()=>0).ok);
  assert.equal(G.load(G.serialize(s)).records.tower, 1);
});

test('a fully wiped party can retry and a paid evolution consumes exactly one chip', () => {
  const s = G.create('agumon', 0);
  s.routeWins[0] = 3;
  assert.ok(G.challenge(s,'metalseadramon'));
  s.battle.allyHp = 1;
  assert.match(G.step(s,()=>0,0), /败退/);
  assert.ok(G.challenge(s,'metalseadramon'));
  G.recover(s);
  const uid=s.team[0];
  s.mons[uid].level=28;
  assert.ok(G.evolve(s,uid,'greymon'));
  assert.equal(G.evolve(s,uid,'metalgreymonvirus'),false);
  s.bag['evolution-chip']=1;
  assert.ok(G.evolve(s,uid,'metalgreymonvirus'));
  assert.equal(s.bag['evolution-chip'],0);
  assert.equal(G.evolve(s,uid,'metalgreymonvirus'),false);
});

test('each starter can reach the ending using only legal progression actions', () => {
  for (const id of G.starters) {
    const s = G.create(id,0);
    assert.equal(G.travel(s,4),false);
    for (let i=0;i<G.bosses.length;i++) {
      assert.ok(G.travel(s,i));
      for (let j=0;j<400&&s.cleared.length===i;j++) {
        if (!s.battle&&s.routeWins[i]>=3) G.challenge(s,G.bosses[i].id);
        G.step(s,()=>0.25,0);
      }
      assert.equal(s.cleared[i],G.bosses[i].id,id);
    }
  }
});

test('no trade activity exists and every evolution is gated by level only', () => {
  const s = G.create('agumon',0);
  assert.equal(G.activities.trade, undefined);
  assert.equal(G.activity(s,'trade',()=>0).ok, false);
  // 成熟期门槛 Lv.15：不满足等级时禁止进化，达到后无需任何交换或道具
  s.mons[s.team[0]].level = 14;
  assert.equal(G.evolve(s,s.team[0],'greymon'), false);
  s.mons[s.team[0]].level = 15;
  assert.ok(G.evolve(s,s.team[0],'greymon'));
});

test('duplicate captures convert into coins and team experience instead of storage', () => {
  const s = G.create('agumon', 0);
  const coins = s.coins, level = s.mons[s.team[0]].level;
  let last = '';
  for (let i = 0; i < 200; i++) {
    const message = G.step(s, () => 0, 0);
    if (message.includes('已转化为')) last = message;
  }
  assert.ok(s.dupes > 0, 'duplicates are counted');
  assert.equal(s.box.length, 0, 'duplicates never occupy storage');
  assert.ok(s.team.length <= 2, 'no extra copy joins the team');
  assert.equal(s.box.length, 0);
  assert.ok(s.coins > coins, 'duplicates pay coins');
  assert.ok(s.mons[s.team[0]].level > level, 'duplicates feed team experience');
  assert.match(last, /已转化为/);
  assert.deepEqual(s.bag, {}, 'no item is consumed');
});

test('a shiny duplicate is still collected when no shiny is owned', () => {
  const s = G.create('agumon', 0);
  s.mons[s.team[0]].level = 100;
  s.battle = {kind:'wild',id:'agumon',name:'亚古兽',level:5,hp:1,shiny:true,allyHp:100};
  G.step(s, () => 0, 0);
  assert.equal(s.team.length, 2);
  assert.equal(s.mons[s.team[1]].shiny, true);
  // 已经拥有异色后，再遇到同种异色按重复折算
  s.battle = {kind:'wild',id:'agumon',name:'亚古兽',level:5,hp:1,shiny:true,allyHp:100};
  G.step(s, () => 0, 0);
  assert.equal(s.team.length, 2);
});

test('a full storage converts new species instead of dropping them, and release frees space', () => {
  const s = G.create('agumon', 0);
  for (let i = 1; i < 6; i++) { s.mons['t'+i] = {id:'agumon',level:5,xp:0,shiny:false}; s.team.push('t'+i); }
  for (let i = 0; i < G.boxMax; i++) {
    const uid = 'x' + i;
    s.mons[uid] = {id:'betamon',level:2,xp:0,shiny:false};
    s.box.push(uid);
  }
  s.battle = {kind:'wild',id:'palmon',name:'巴鲁兽',level:5,hp:1,shiny:false,allyHp:100};
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
  const a = G.create('agumon', 0), b = G.create('agumon', 0);
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
  const s = G.create('agumon', 0);
  const report = G.offline(s, 60 * 24 * 3600000);
  assert.ok(report.truncated, '显示为已截断');
  assert.equal(report.rounds, Math.floor(72 * 3600000 / 1100), '72 小时对应的回合数');
});

test('closed-page offline run progresses battles, captures and coins deterministically', () => {
  const a = G.create('agumon', 0), b = G.create('agumon', 0);
  const ra = G.offline(a, 6 * 3600000), rb = G.offline(b, 6 * 3600000);
  assert.ok(ra.rounds > 1000, 'hours away become simulated rounds');
  assert.ok(ra.coins > 0, 'captures and wins pay coins');
  assert.ok(ra.catches > 0, 'wild wins are captured offline');
  assert.ok(a.mons[a.team[0]].level > 5, 'the party keeps gaining levels offline');
  // 同一存档 + 同一离线时长 => 完全一致的结果（mulberry32 种子为 savedAt）
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  // 离线段可以继续序列化为 JSON 存档并由 load 读回
  const restored = G.load(G.serialize(a));
  assert.equal(restored.team[0], a.team[0]);
  assert.equal(restored.coins, a.coins);
});

test('casino slots pay tokens, pachinko spends tokens, and locked wagers charge nothing', () => {
  const s = G.create('agumon',0);
  assert.equal(G.casino(s,'slots',()=>0).ok,false);
  assert.equal(s.coins,20);
  s.cleared=G.bosses.slice(0,2).map(b=>b.id);
  assert.equal(G.casino(s,'pachinko',()=>0).ok,false);
  const spin=G.casino(s,'slots',()=>0);
  assert.equal(spin.lines.length,5);
  assert.equal(s.coins,10);
  assert.ok(s.bag.token>=2);
  const tokens=s.bag.token;
  assert.ok(G.casino(s,'pachinko',()=>0).ok);
  assert.equal(s.bag.token,tokens-2);
  assert.equal(s.bag.ration,1);
});
