'use strict';
const DigitalGame = (() => {
  const dex = typeof module === 'undefined' ? pokemonDex : require('./catalog.js').dex;
  // 主线：关都 8 枚道馆徽章 + 冠军战，按击败顺序解锁。
  const bosses = [
    ['尼比道馆 · 小刚'], ['华蓝道馆 · 小霞'], ['枯叶道馆 · 马志士'],
    ['彩虹道馆 · 莉佳'], ['浅红道馆 · 阿桔'], ['金黄道馆 · 娜姿'],
    ['红莲道馆 · 夏伯'], ['常磐道馆 · 坂木'], ['宝可梦联盟 · 青绿']
  ].map(([name],i) => ({id:'gym'+(i+1),name,level:12+i*6}));
  const routes = ['1号道路','月见山','地鼠洞窟','宝可梦塔','自行车道','金黄市','双子岛','冠军之路','华蓝洞窟'];
  const items = {
    'evolution-chip':{name:'进化石',price:40,gate:1,count:1},
    ration:{name:'伤药',price:15,gate:0,count:1},
    token:{name:'游戏城代币',price:12,gate:2,count:1}
  };
  const activities = {
    raid:{name:'道馆重赛',gate:2,level:19,reward:50},
    legend:{name:'传说遭遇',gate:3,level:24,reward:65},
    tower:{name:'对战塔',gate:3,level:21,reward:45},
    underground:{name:'地下通道',gate:1},
    casino:{name:'游戏城',gate:2}
  };
  // 属性克制表（攻击方 → 防守方倍率），未列出的组合为 1 倍。
  const EFF = {
    '一般':{'岩石':0.5,'幽灵':0,'钢':0.5},
    '火':{'火':0.5,'水':0.5,'草':2,'冰':2,'虫':2,'岩石':0.5,'龙':0.5,'钢':2},
    '水':{'火':2,'水':0.5,'草':0.5,'地面':2,'岩石':2,'龙':0.5},
    '电':{'水':2,'电':0.5,'草':0.5,'地面':0,'飞行':2,'龙':0.5},
    '草':{'火':0.5,'水':2,'草':0.5,'毒':0.5,'地面':2,'飞行':0.5,'虫':0.5,'岩石':2,'龙':0.5,'钢':0.5},
    '冰':{'火':0.5,'水':0.5,'草':2,'冰':0.5,'地面':2,'飞行':2,'龙':2,'钢':0.5},
    '格斗':{'一般':2,'冰':2,'毒':0.5,'飞行':0.5,'超能':0.5,'虫':0.5,'岩石':2,'幽灵':0,'恶':2,'钢':2,'妖精':0.5},
    '毒':{'草':2,'毒':0.5,'地面':0.5,'岩石':0.5,'幽灵':0.5,'钢':0,'妖精':2},
    '地面':{'火':2,'电':2,'草':0.5,'毒':2,'飞行':0,'虫':0.5,'岩石':2,'钢':2},
    '飞行':{'电':0.5,'草':2,'格斗':2,'虫':2,'岩石':0.5,'钢':0.5},
    '超能':{'格斗':2,'毒':2,'超能':0.5,'恶':0,'钢':0.5},
    '虫':{'火':0.5,'草':2,'格斗':0.5,'毒':0.5,'飞行':0.5,'超能':2,'幽灵':0.5,'恶':2,'钢':0.5,'妖精':0.5},
    '岩石':{'火':2,'冰':2,'格斗':0.5,'地面':0.5,'飞行':2,'虫':2,'钢':0.5},
    '幽灵':{'一般':0,'超能':2,'幽灵':2,'恶':0.5},
    '龙':{'龙':2,'钢':0.5,'妖精':0},
    '恶':{'格斗':0.5,'超能':2,'幽灵':2,'恶':0.5,'妖精':0.5},
    '钢':{'火':0.5,'水':0.5,'电':0.5,'冰':2,'岩石':2,'钢':0.5,'妖精':2},
    '妖精':{'火':0.5,'格斗':2,'毒':0.5,'龙':2,'恶':2}
  };
  const eff = (atk,defTypes) => (defTypes||['一般']).reduce((m,t)=>m*((EFF[atk]||{})[t]??1),1);
  const hour = 3600000;
  const starters = ['p001','p004','p007']; // 妙蛙种子 / 小火龙 / 杰尼龟
  const boxMax = 300; // 仓库容量：捕获免费且不限次数，用仓库上限兜住挂机产出
  const boardMax = 4; // 培育屋寄放位
  const DITTO = 'p132'; // 孵蛋需要一只百变怪
  // 昼夜与天气：夜间（本地 18:00-6:00）出最终形态，雨天再叠加传说。
  function weather(now) {
    const h=new Date(now).getHours();
    return {night:h<6||h>=18, rain:Math.floor(now/hour)%3===2};
  }
  // 单机成就：全部可离线达成，按存档即时推导。
  const achievements = [
    {id:'start',name:'冒险启程',desc:'从大木博士那里领到第一只伙伴',need:1},
    {id:'catch10',name:'新手捕手',desc:'累计捕获 10 只宝可梦',need:10},
    {id:'catch100',name:'捕虫少年',desc:'累计捕获 100 只宝可梦',need:100},
    {id:'catch500',name:'捕捉大师',desc:'累计捕获 500 只宝可梦',need:500},
    {id:'win25',name:'初出茅庐',desc:'赢得 25 场战斗',need:25},
    {id:'win200',name:'身经百战',desc:'赢得 200 场战斗',need:200},
    {id:'win1000',name:'关都传奇',desc:'赢得 1000 场战斗',need:1000},
    {id:'badge1',name:'第一枚徽章',desc:'击败尼比道馆的小刚',need:1},
    {id:'badge4',name:'半程徽章',desc:'集齐 4 枚道馆徽章',need:4},
    {id:'badge8',name:'徽章收藏家',desc:'集齐 8 枚道馆徽章',need:8},
    {id:'champion',name:'联盟冠军',desc:'击败冠军青绿',need:9},
    {id:'dex10',name:'图鉴初填',desc:'收录 10 种宝可梦',need:10},
    {id:'dex50',name:'图鉴过半',desc:'收录 75 种宝可梦',need:75},
    {id:'dex151',name:'全图鉴',desc:'收录关都全部 151 种',need:151},
    {id:'shiny',name:'闪光时刻',desc:'收服一只异色宝可梦',need:1},
    {id:'dupes50',name:'变废为宝',desc:'重复个体折算 50 次',need:50},
    {id:'egg1',name:'新生命',desc:'在培育屋孵出第一只宝可梦',need:1},
    {id:'egg10',name:'培育专家',desc:'累计孵化 10 只宝可梦',need:10},
    {id:'level100',name:'满级伙伴',desc:'拥有一只 Lv.100 的宝可梦',need:1},
    {id:'rich',name:'小富翁',desc:'持有 10000 金币',need:1},
    {id:'casino10',name:'游戏城常客',desc:'在游戏城游玩 10 次',need:10},
    {id:'tower10',name:'对战塔挑战者',desc:'通关对战塔 10 次',need:10},
    {id:'box100',name:'仓库管理员',desc:'仓库同时存有 100 只宝可梦',need:100},
  ];
  // 依据存档推导已达成的成就 id（不落盘，随进度实时解锁）。
  function achieved(s) {
    const stats=s.stats||{catches:0,wins:0};
    const value={
      start:1, catch10:stats.catches, catch100:stats.catches, catch500:stats.catches,
      win25:stats.wins, win200:stats.wins, win1000:stats.wins,
      badge1:s.cleared.length, badge4:s.cleared.length, badge8:s.cleared.length,
      champion:s.cleared.includes('gym9')?9:0,
      dex10:s.seen.length, dex50:s.seen.length, dex151:s.seen.length,
      shiny:Object.values(s.mons).some(m=>m.shiny)?1:0,
      dupes50:s.dupes??0, egg1:s.hatched??0, egg10:s.hatched??0,
      level100:Object.values(s.mons).some(m=>m.level>=100)?1:0,
      rich:s.coins>=10000?1:0, casino10:s.records.casino??0,
      tower10:s.records.tower??0, box100:s.box.length,
    };
    return achievements.filter(a=>(value[a.id]??0)>=a.need).map(a=>a.id);
  }
  const hp = mon => 22 + mon.level * 4 + dex[mon.id].stage * 5;
  const add = (s,id,level,shiny=false) => {
    const uid = 'm'+s.nextUid++;
    s.mons[uid] = {id,level,xp:0,shiny};
    if (s.team.length < 6) s.team.push(uid);
    else if (s.box.length < boxMax) s.box.push(uid);
    else { delete s.mons[uid]; return null; } // 仓库已满，无法收容
    if (!s.seen.includes(id)) s.seen.push(id);
    return uid;
  };
  function create(id,now) {
    if (!starters.includes(id)) throw new Error('Invalid starter');
    const s = {v:1,nextUid:1,mons:{},team:[],box:[],seen:[],discovered:[],
      coins:3000,bag:{},dupes:0,route:0,routeWins:[0,0,0,0,0,0,0,0,0],cleared:[],
      battle:null,lead:0,swap:null,presets:[null,null,null,null,null],
      board:[],egg:null,hatched:0,stats:{catches:0,wins:0},records:{},savedAt:now,speed:1};
    add(s,id,5);
    return s;
  }
  function recover(s) {
    if (s.swap) {
      const [a,b] = s.swap;
      const i = s.team.indexOf(a), j = s.box.indexOf(b);
      if (i >= 0 && j >= 0) [s.team[i],s.box[j]] = [b,a];
      s.swap = null;
    }
    s.battle = null;
    s.lead = 0;
  }
  function queueSwap(s,a,b) {
    if (!s.team.includes(a) || !s.box.includes(b)) return false;
    s.swap = [a,b];
    return true;
  }
  function preset(s,index,write) {
    if (!Number.isInteger(index) || index<0 || index>=5 || s.battle) return false;
    if (write) { s.presets[index] = [...s.team]; return true; }
    const ids = s.presets[index]?.filter(uid=>s.mons[uid] && !(s.board||[]).some(b=>b.uid===uid));
    if (!ids?.length) return false;
    s.team = [...ids];
    s.box = Object.keys(s.mons).filter(uid=>!ids.includes(uid) && !(s.board||[]).some(b=>b.uid===uid));
    recover(s);
    return true;
  }
  // 进化只按等级触发：基础形态 Lv.16 → 一阶、一阶 Lv.32 → 最终形态。
  // 图鉴按真实进化链连线，传说宝可梦（stage 3）没有 next，自然不可进化。
  function evolve(s,uid,target) {
    const mon = s.mons[uid], form = dex[mon?.id];
    if (!form?.next.includes(target) || s.battle) return false;
    if (mon.level < [16,32][form.stage]) return false;
    mon.id = target;
    if (!s.seen.includes(target)) s.seen.push(target);
    return true;
  }
  function encounter(s,random,now) {
    const night = new Date(now).getHours() < 6 || new Date(now).getHours() >= 18;
    const rain = Math.floor(now/hour)%3===2;
    const pool = Object.keys(dex).filter(id => {
      const d = dex[id];
      if (d.version !== s.route+1) return false;
      if (d.stage === 2 && !(night || rain)) return false;   // 最终形态：夜间或雨天
      if (d.stage === 3 && !(night && rain)) return false;   // 传说：夜间且雨天
      return true;
    });
    const id = pool[Math.floor(random()*pool.length)];
    const level = 2+s.route*5;
    if (!s.discovered.includes(id)) s.discovered.push(id);
    s.battle = {kind:'wild',id,name:dex[id].name,level,hp:14+level*3,shiny:random()<0.025,allyHp:hp(s.mons[s.team[0]])};
  }
  function challenge(s,id) {
    const boss = bosses[s.cleared.length];
    if (s.battle || !boss || boss.id!==id || s.routeWins[s.cleared.length]<3) return false;
    s.battle = {...boss,kind:'boss',hp:24+boss.level*4,allyHp:hp(s.mons[s.team[0]])};
    return true;
  }
  function travel(s,index) {
    if (!Number.isInteger(index)||!routes[index]||index>s.cleared.length||s.battle) return false;
    s.route=index;
    return true;
  }
  function train(mon,xp) {
    mon.xp += xp;
    while (mon.level < 100 && mon.xp >= mon.level*3) {
      mon.xp -= mon.level*3;
      mon.level++;
    }
  }
  // 重复精灵折算：少量金币（1 + 等级÷3，向下取整）+ 全队一份与击败
  // 同级野生相同的经验，替代直接入库。重复个体出现频率高，金币刻意压低。
  function convert(s,b) {
    const coins=1+Math.floor(b.level/3);
    s.coins+=coins;
    for (const uid of s.team) train(s.mons[uid],b.level*2+2);
    s.dupes=(s.dupes??0)+1;
    return coins;
  }
  function step(s,random=Math.random,now=Date.now()) {
    if (!s.battle) {
      encounter(s,random,now);
      return '遇见 '+s.battle.name;
    }
    const b = s.battle, mon = s.mons[s.team[s.lead]];
    const multiplier = Math.max(0.25, eff(dex[mon.id].types[0], dex[b.id]?.types));
    const hit = Math.round((5+mon.level*2+dex[mon.id].stage)*multiplier*(0.9+random()*0.2));
    b.hp = Math.max(0,b.hp-hit);
    if (b.hp) {
      b.allyHp = Math.max(0,b.allyHp-(3+b.level));
      if (b.allyHp) return dex[mon.id].name+' 攻击，造成 '+hit+' 伤害';
      s.lead++;
      if (s.lead < s.team.length) {
        b.allyHp=hp(s.mons[s.team[s.lead]]);
        return '下一位伙伴接战';
      }
      recover(s);
      return '队伍败退，已返回治疗中心';
    }
    for (const uid of s.team) train(s.mons[uid], b.level*2+2);
    s.coins += b.reward ?? 5+b.level;
    s.stats=s.stats||{catches:0,wins:0};
    s.stats.wins++;
    let message = '击败 '+b.name;
    if (b.kind==='boss') {
      s.cleared.push(b.id);
      message += b.id==='gym9'?' · 联盟通关':' · 获得徽章，解锁下一条路线';
    } else if (b.kind==='activity') {
      s.records[b.activity]=(s.records[b.activity]??0)+1;
    } else {
      s.routeWins[s.route]++;
      // 捕获不限次数、不消耗道具：每次野外胜利都有 65% 机会收容对方。
      // 同种且无收藏价值时自动折算为金币与全队经验，避免仓库被重复精灵占满。
      const catchProb = Math.min(0.95, 0.3 + 0.6*(dex[b.id]?.captureRate ?? 190)/255);
      if (random()<catchProb) {
        const owned=Object.values(s.mons).some(mon=>mon.id===b.id);
        const keepsShiny=b.shiny&&!Object.values(s.mons).some(mon=>mon.id===b.id&&mon.shiny);
        if (owned&&!keepsShiny) {
          message += ' · 重复的'+b.name+'已转化为 '+convert(s,b)+' 金币与队伍经验';
        } else {
          const destination = s.team.length<6?'队伍':'仓库';
          const uid = add(s,b.id,b.level,b.shiny);
          s.stats.catches += uid?1:0;
          message += uid ? ' · 捕获成功，进入'+destination
                         : ' · 仓库已满（'+boxMax+'），'+b.name+'已转化为 '+convert(s,b)+' 金币与队伍经验';
        }
      } else message += ' · 捕获失败';
    }
    recover(s);
    return message;
  }
  function buy(s,id) {
    const item=items[id];
    if (!item || s.cleared.length<item.gate || s.coins<item.price) return false;
    s.coins-=item.price;
    s.bag[id]=(s.bag[id]??0)+item.count;
    return true;
  }
  // 卖出：商店按半价回收道具。
  function sell(s,id) {
    const item=items[id];
    if (!item || !(s.bag[id]>0)) return false;
    s.bag[id]--;
    if (!s.bag[id]) delete s.bag[id];
    s.coins+=Math.floor(item.price/2);
    return true;
  }
  function use(s,id) {
    if (!(s.bag[id]>0) || !s.battle || id!=='ration') return false;
    s.bag[id]--;
    s.battle.allyHp=hp(s.mons[s.team[s.lead]]);
    return true;
  }
  // 训练：花费金币给一名队伍/仓库成员做特训，立刻结算一份大额经验。
  function trainSession(s,uid) {
    const mon=s.mons[uid];
    if (!mon || s.battle) return false;
    const cost=mon.level*4;
    if (s.coins<cost) return false;
    s.coins-=cost;
    train(mon,mon.level*3+6);
    return true;
  }
  // 培育屋：最多寄放 4 只；拥有百变怪时，寄放会产下一枚蛋（同版本幼年体），
  // 没有百变怪则只提供经验加成。
  function hasDitto(s) {
    return [...s.team,...s.box,...(s.board||[]).map(b=>b.uid)]
      .some(uid=>s.mons[uid]?.id===DITTO);
  }
  function board(s,uid,now) {
    const index=s.box.indexOf(uid);
    if (index<0 || (s.board||[]).length>=boardMax) return false;
    s.board=s.board||[];
    s.board.push({uid,lastAt:now});
    s.box.splice(index,1);
    if (!s.egg && hasDitto(s)) {
      const version=dex[s.mons[uid].id].version;
      s.egg={id:Object.keys(dex).find(id=>dex[id].version===version&&dex[id].stage===0),at:now+4*hour};
    }
    return true;
  }
  function takeBack(s,index=0) {
    const slot=(s.board||[])[index];
    if (!slot) return false;
    s.board.splice(index,1);
    s.box.push(slot.uid);
    return true;
  }
  // 放生：释放仓库中的伙伴，为捕获腾出空间（队伍成员不可放生；
  // 仓库成员不参与当前战斗，因此战斗中也可操作）。
  function release(s,uid) {
    const index=s.box.indexOf(uid);
    if (index<0 || (s.board||[]).some(b=>b.uid===uid)) return false;
    s.box.splice(index,1);
    delete s.mons[uid];
    return true;
  }
  function claimEgg(s,now) {
    if (!s.egg || now<s.egg.at) return false;
    if (!add(s,s.egg.id,1)) return false; // 仓库已满时保留孵化结果
    s.hatched=(s.hatched??0)+1;
    s.egg=null;
    return true;
  }
  function pension(s,now) {
    for (const slot of s.board||[]) {
      const elapsed=Math.max(0,Math.min(8*hour,now-slot.lastAt));
      const ticks=Math.floor(elapsed/(2*60000));
      if (!ticks) continue;
      const version=dex[s.mons[slot.uid].id].version;
      for (const mon of Object.values(s.mons)) if (dex[mon.id].version===version) train(mon,ticks);
      slot.lastAt=now;
    }
  }
  function catchUp(s,now) {
    const elapsed=Math.max(0,Math.min(8*hour,now-s.savedAt));
    if (!elapsed) return {elapsed,coins:0};
    const rounds=Math.floor(elapsed/60000);
    const coins=rounds*(s.route+1);
    s.coins+=coins;
    for (const uid of s.team) train(s.mons[uid],rounds);
    pension(s,now);
    s.savedAt=now;
    return {elapsed,coins};
  }
  // 可复现的伪随机数（mulberry32），保证同一存档+同一离线时长的推演结果一致。
  function mulberry32(seed) {
    let a=seed>>>0;
    return function() {
      a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  const tickMs=1100; // 与在线挂机节奏一致：1100ms / 倍速
  const maxOffline=72*hour; // 离线推演上限 72 小时：超过部分不再累计
  // 关闭页面期间的完整离线推演：按离线时长逐步模拟遭遇、战斗、捕获、
  // 金币与经验结算；满足条件时自动挑战首领。捕获免费不限次数，
  // 仓库达到上限后停止收容，避免挂机无限刷怪。
  // 生成器版本：每 chunk 回合让出一次，供页面分块执行并显示进度，
  // 避免 72 小时满额结算（约 23.5 万回合）时阻塞主线程。
  function* offlineSteps(s,now,chunk=30000) {
    const from=s.savedAt;
    const elapsed=Math.max(0,now-from);
    const total=Math.floor(elapsed/tickMs);
    const rounds=Math.min(total,Math.floor(maxOffline/tickMs));
    const truncated=total>rounds;
    if (!rounds) {
      s.savedAt=Math.max(s.savedAt,now);
      return {elapsed,rounds:0,credited:0,coins:0,catches:0,dupes:0,wins:0,newSeen:[],bosses:[],truncated};
    }
    const random=mulberry32(from);
    const coins0=s.coins, wins0=s.stats?.wins||0, seen0=[...s.seen];
    let catches=0, dupes=0, lastBossAt=-999;
    const cleared=[];
    for (let i=0;i<rounds;i++) {
      const t=from+i*tickMs;
      if (!s.battle) {
        const boss=bosses[s.cleared.length];
        // 练度足够（领队等级≥首领等级）且冷却已过时才自动挑战，否则继续在野外练级。
        if (boss && s.routeWins[s.cleared.length]>=3 && s.mons[s.team[0]].level>=boss.level && i-lastBossAt>300) {
          lastBossAt=i;
          challenge(s,boss.id);
        }
        if (!s.battle) encounter(s,random,t);
      }
      if (s.battle) {
        const before=s.cleared.length;
        const message=step(s,random,t);
        if (message.includes('捕获成功')) catches++;
        if (message.includes('已转化为')) dupes++;
        if (s.cleared.length>before) cleared.push(bosses[s.cleared.length-1].name);
      }
      if ((i+1)%chunk===0) yield {rounds:i+1,total:rounds};
    }
    pension(s,now);
    s.savedAt=now;
    return {elapsed,rounds,credited:rounds*tickMs,coins:s.coins-coins0,catches,dupes,wins:(s.stats?.wins||0)-wins0,
      newSeen:s.seen.filter(id=>!seen0.includes(id)),bosses:cleared,truncated};
  }
  // 同步结算（测试与不需要进度的场景使用），一次跑完所有回合。
  function offline(s,now) {
    const iterator=offlineSteps(s,now);
    let result=iterator.next();
    while (!result.done) result=iterator.next();
    return result.value;
  }
  function activity(s,id,random=Math.random) {
    const a=activities[id];
    if (!a || s.battle || s.cleared.length<a.gate) return {ok:false,message:'条件不足或战斗中'};
    if (a.level) {
      const level=a.level+(id==='tower'?(s.records.tower??0)*2:0);
      s.battle={kind:'activity',activity:id,name:a.name,level,hp:24+level*3,reward:a.reward,allyHp:hp(s.mons[s.team[0]])};
    } else if (id==='casino') {
      return casino(s,'slots',random);
    } else {
      const price=5;
      if (s.coins<price) return {ok:false,message:'余额不足'};
      s.coins-=price;
      s.bag.ration=(s.bag.ration??0)+1+Math.floor(random()*3);
    }
    if (!a.level) s.records[id]=(s.records[id]??0)+1;
    return {ok:true,message:a.name+(a.level?'已开始':'已结算')};
  }
  function casino(s,mode,random=Math.random) {
    if (s.battle||s.cleared.length<2) return {ok:false,message:'赌场尚不可用'};
    if (mode==='slots') {
      if (s.coins<10) return {ok:false,message:'需要 10 数码币'};
      const symbols=['◆','●','▲','★'];
      const lines=Array.from({length:5},()=>Array.from({length:3},()=>symbols[Math.floor(random()*4)]));
      const tokens=lines.filter(([a,b,c])=>a===b&&b===c).length*2;
      s.coins-=10;
      s.bag.token=(s.bag.token??0)+tokens;
      s.records.casino=(s.records.casino??0)+1;
      return {ok:true,lines,message:lines.map(line=>line.join(' ')).join(' ｜ ')+' · 获得 '+tokens+' 代币'};
    }
    if (mode!=='pachinko'||!(s.bag.token>=2)) return {ok:false,message:'需要 2 枚代币'};
    s.bag.token-=2;
    if (random()<0.5) {
      s.bag.ration=(s.bag.ration??0)+1;
      return {ok:true,message:'弹珠落入补给槽，获得 1 份回复补给'};
    }
    s.bag.token+=3;
    return {ok:true,message:'弹珠落入代币槽，获得 3 枚代币'};
  }
  function load(raw) {
    try {
      const s=JSON.parse(raw);
      if (s?.v!==1 || !s.team?.length || s.team.length>6 || !s.mons ||
          !Array.isArray(s.box) || !Array.isArray(s.seen) || !Array.isArray(s.cleared) ||
          !Array.isArray(s.routeWins) || !Array.isArray(s.presets) || !s.bag || !s.records ||
          !Number.isFinite(s.savedAt) || !routes[s.route] ||
          [...s.team,...s.box].some(uid=>!dex[s.mons[uid]?.id])) return null;
      // 旧存档迁移：boarded（单槽）→ board（4 槽），并补齐统计字段。
      if (s.boarded) { s.board=[s.boarded]; delete s.boarded; }
      s.board=Array.isArray(s.board)?s.board.filter(b=>s.mons[b?.uid]):[];
      s.stats=s.stats||{catches:0,wins:0};
      s.hatched=s.hatched??0;
      return s;
    } catch { return null; }
  }
  return {dex,bosses,routes,items,activities,starters,boxMax,boardMax,maxOffline,tickMs,weather,achievements,achieved,hp,create,step,recover,queueSwap,preset,evolve,
    challenge,travel,buy,sell,use,trainSession,board,takeBack,release,claimEgg,pension,catchUp,offline,offlineSteps,activity,casino,load,serialize:JSON.stringify};
})();
if (typeof module !== 'undefined') module.exports = DigitalGame;
