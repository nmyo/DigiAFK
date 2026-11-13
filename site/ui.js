'use strict';
(() => {
  const G=DigitalGame, $=id=>document.getElementById(id);
  const SAVE_NAME='pokecatch-save.json';
  let state, page='adventure', screen='title', paused=false, timer, selected;
  let fileHandle=null, lastWrite=0, worker=null, settling=false, shopTab='buy';
  // File System Access API（Chromium 系）：可对同一个 JSON 文件自动续写。
  const hasFS=typeof window.showOpenFilePicker==='function'&&typeof window.showSaveFilePicker==='function';
  let fsUsable=hasFS;
  const status=text=>{$('saveStatus').textContent=text;};
  const notice=text=>{$('notice').textContent=text;};
  const btn=(action,value,label,disabled=false)=>
    '<button class="btn small" data-action="'+action+'" data-value="'+value+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
  const DEX_TOTAL=Object.keys(G.dex).length;
  const STAGE=['基础','一阶','最终','传说'];
  const art=(id,shiny,size)=>{
    const d=G.dex[id];
    const cls='art'+(size?' small':'');
    return d?'<img class="'+cls+'" alt="" src="assets/pokemon/'+(shiny?'shiny/':'')+d.no+'.png">':
      '<span class="'+cls+' placeholder" aria-hidden="true">?</span>';
  };
  const name=uid=>G.dex[state.mons[uid].id].name;
  const label=uid=>name(uid)+' · Lv.'+state.mons[uid].level+(state.mons[uid].shiny?' ✦':'');

  // ---- JSON 文件存档 ----
  async function writeHandle(handle,text) {
    const writable=await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }
  async function persist(force=false,now=Date.now()) {
    if (!state) return;
    state.savedAt=Math.max(state.savedAt,now);
    const raw=G.serialize(state);
    if (fileHandle&&(force||Date.now()-lastWrite>5000)) {
      try {
        await writeHandle(fileHandle,raw);
        lastWrite=Date.now();
        status('已自动保存');
      } catch { status('存档写入失败，请重新打开或导出'); }
    } else if (!fileHandle) {
      status(fsUsable?'内存中 · 请导出保存':'请定期导出备份');
    }
  }
  async function pickSaveTarget() {
    if (!fsUsable) return false;
    try {
      fileHandle=await window.showSaveFilePicker({suggestedName:SAVE_NAME,
        types:[{description:'宝可梦图鉴存档',accept:{'application/json':['.json']}}]});
      lastWrite=0;
      return true;
    } catch (error) {
      if (error?.name!=='AbortError') fsUsable=false; // 环境不支持/被拒绝时退回下载模式
      return false;
    }
  }
  function download() {
    if (!state) { notice('还没有可导出的进度。'); return; }
    state.savedAt=Math.max(state.savedAt,Date.now());
    const blob=new Blob([G.serialize(state)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=SAVE_NAME;
    a.click();
    URL.revokeObjectURL(a.href);
    status('已导出 '+SAVE_NAME);
  }
  function loadFrom(text) {
    const s=G.load(text);
    if (!s) { status('存档无法读取'); return; }
    state=s;
    enter(true);
  }
  async function openSave() {
    if (!fsUsable) { $('save-file').click(); return; }
    try {
      const [handle]=await window.showOpenFilePicker({types:
        [{description:'宝可梦图鉴存档',accept:{'application/json':['.json']}}]});
      const text=await (await handle.getFile()).text();
      fileHandle=handle;
      lastWrite=0;
      loadFrom(text);
    } catch (error) {
      if (error?.name!=='AbortError') { fsUsable=false; $('save-file').click(); }
    }
  }

  // ---- 后台持续运行：Worker 计时器不受后台标签页节流限制 ----
  function makeWorker(interval) {
    try {
      const src='let t=null;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(1),e.data)};';
      const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
      w.onmessage=()=>tick();
      return w;
    } catch { return null; }
  }
  function stopLoop() {
    if (worker) worker.postMessage(0);
    clearInterval(timer);
  }
  function schedule() {
    stopLoop();
    if (paused||screen!=='game') return;
    const interval=Math.max(50,Math.round(1100/(state?.speed||1)));
    worker=makeWorker(interval);
    if (worker) worker.postMessage(interval);
    else timer=setInterval(tick,interval);
  }
  function tick() {
    if (paused||screen!=='game') return;
    const now=Date.now();
    record(G.step(state,Math.random,now));
    G.pension(state,now);
    persist(false,now);
    render();
  }
  function topbar() {
    if (!state) return;
    $('top-coins').innerHTML='<b>'+state.coins.toLocaleString()+' ₽</b>';
    $('top-dex').textContent='图鉴 '+state.seen.length+'/'+DEX_TOTAL;
    const w=G.weather(Date.now());
    $('top-weather').textContent=(w.night?'🌙 夜间':'☀ 白天')+(w.rain?' · 🌧 雨天':'');
  }
  function render() {
    // bundle CSS 用 .screen{display:none} / .screen.active 控制显隐
    const show=(id,on)=>{const el=$(id);el.hidden=!on;el.classList.toggle('active',on);};
    show('screen-title',screen==='title');
    show('screen-starter',screen==='starter');
    $('new-game').textContent=state?'新建冒险（覆盖当前进度）':'NEW GAME';
    if (screen!=='game') return;
    topbar();
    document.querySelectorAll('[data-page]').forEach(el=>{
      const on=el.id==='screen-'+page;
      el.hidden=!on;
      el.classList.toggle('active',on);
    });
    document.querySelectorAll('#pc-side [data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===page));
    if (page==='progress') progress();
    if (page==='adventure') adventure();
    if (page==='team') team();
    if (page==='dex') dex();
    if (page==='shop') shop();
    if (page==='pension') pension();
    if (page==='activities') activities();
    if (page==='achievements') achievements();
  }
  // ---- 进度页 ----
  function progress() {
    const s=state;
    const pct=Math.round(s.cleared.length/G.bosses.length*100);
    $('prog-bar').value=pct;
    $('prog-pct').textContent='主线 '+s.cleared.length+' / '+G.bosses.length;
    const ball='<svg viewBox="0 0 60 60" width="26" height="26" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="#fff" stroke="#1b1b22" stroke-width="4"/><path d="M4 30h18M38 30h18" stroke="#1b1b22" stroke-width="4"/><circle cx="30" cy="30" r="9" fill="#fff" stroke="#1b1b22" stroke-width="4"/><path d="M4 30a26 26 0 0 1 52 0z" fill="#e3353b" stroke="#1b1b22" stroke-width="0"/></svg>';
    $('badge-wall').innerHTML=G.bosses.map((b,i)=>
      '<div class="badge'+(s.cleared.includes(b.id)?' won':'')+'"><div class="bicon">'+
      (s.cleared.includes(b.id)?ball:'<svg viewBox="0 0 60 60" width="26" height="26" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M4 30h52" stroke="currentColor" stroke-width="4"/><circle cx="30" cy="30" r="9" fill="none" stroke="currentColor" stroke-width="4"/></svg>')+
      '</div>'+b.name.split(' · ')[1]+'</div>').join('');
    $('route-list').innerHTML=G.routes.map((r,i)=>{
      const locked=i>s.cleared.length, done=s.routeWins[i]>=3&&i<s.cleared.length;
      return '<div class="entry"><b style="min-width:84px">'+r+'</b>'+
        '<span class="muted">获胜 '+s.routeWins[i]+'/3</span>'+
        '<span>'+(i===s.route?'<b style="color:var(--gold-soft)">当前位置</b>':locked?'🔒 未解锁':done?'✅ 已通关':'')+'</span>'+
        btn('route',i,'前往',locked||i===s.route||!!s.battle)+'</div>';
    }).join('');
    const stats=s.stats||{catches:0,wins:0};
    const rows=[['累计捕获',stats.catches],['累计胜场',stats.wins],['重复转化',s.dupes??0],
      ['孵化宝可梦',s.hatched??0],['异色持有',Object.values(s.mons).filter(m=>m.shiny).length],
      ['已发现物种',s.discovered.length],['仓库存量',s.box.length+' / '+G.boxMax],
      ['金币',s.coins.toLocaleString()],['游戏城游玩',s.records.casino??0],['对战塔通关',s.records.tower??0]];
    $('trainer-stats').innerHTML=rows.map(([k,v])=>
      '<div class="wstat">'+k+'<b>'+v+'</b></div>').join('');
  }
  function fighter(id,title,level,health,shiny) {
    return art(id,shiny)+'<strong>'+(shiny?'✦ ':'')+title+'</strong><br><small>Lv.'+level+' · HP '+health+'</small>';
  }
  function adventure() {
    const s=state,b=s.battle,mon=s.mons[s.team[s.lead]],boss=G.bosses[s.cleared.length];
    $('campaign-complete').hidden=!s.cleared.includes('gym9');
    $('scene').classList.toggle('river',s.route%2===0);
    $('route-now').textContent=G.routes[s.route];
    $('ally').innerHTML=fighter(mon.id,G.dex[mon.id].name,mon.level,b?.allyHp??G.hp(mon),mon.shiny);
    $('enemy').innerHTML=b?fighter(b.id,b.name,b.level,b.hp,b.shiny):'<small>搜寻踪迹中…</small>';
    $('routes').innerHTML=G.routes.map((r,i)=>btn('route',i,r+' '+s.routeWins[i]+'/3',i>s.cleared.length||i===s.route||!!s.battle)).join('');
    $('boss').textContent=boss?'挑战 '+boss.name:'主线已通关';
    $('boss').disabled=!boss||s.routeWins[s.cleared.length]<3||(b&&b.kind!=='wild');
    $('pause').textContent=paused?'继续':'暂停';
    document.querySelectorAll('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',Number(el.dataset.speed)===s.speed));
  }
  function evolutions(uid) {
    const mon=state.mons[uid];
    const form=G.dex[mon.id], level=[16,32][form.stage]??Infinity;
    return form.next.map(id=>btn('evolve',uid+':'+id,
      G.dex[id].name+' · Lv.'+level,
      !!state.battle||mon.level<level)).join(' ');
  }
  function team() {
    const s=state, q=$('box-search').value.trim().toLowerCase(), order=$('box-order').value;
    $('box-count').textContent='仓库 '+s.box.length+' / '+G.boxMax+(s.box.length>=G.boxMax?' · 已满，新物种将折算':'')+
      ' · 重复转化 '+(s.dupes??0)+' 只';
    $('presets').innerHTML=s.presets.map((ids,i)=>btn('preset',i,(ids?'读取 ':'保存 ')+(i+1),!!s.battle)).join('');
    $('team-list').innerHTML=Array.from({length:6},(_,i)=>{
      const uid=s.team[i];
      return '<div class="entry">'+(uid?art(s.mons[uid].id,s.mons[uid].shiny,true)+btn('select',uid,(selected===uid?'✓ ':'')+label(uid))+' '+evolutions(uid):'空槽')+'</div>';
    }).join('')+(s.swap?'<p>已排队，等待战斗结算。</p>':'');
    const ids=s.box.filter(uid=>name(uid).toLowerCase().includes(q)).reverse();
    if (order==='level') ids.sort((a,b)=>s.mons[b].level-s.mons[a].level);
    if (order==='name') ids.sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));
    $('box').innerHTML=ids.map(uid=>'<div class="entry">'+art(s.mons[uid].id,s.mons[uid].shiny,true)+btn('swap',uid,label(uid),!selected)+' '+evolutions(uid)+' '+btn('train',uid,'特训')+' '+btn('release',uid,'放生')+'</div>').join('')||'<p>没有符合条件的伙伴。</p>';
  }
  function dex() {
    const q=$('dex-search').value.trim().toLowerCase(), mode=$('dex-filter').value;
    const owned=new Set(Object.values(state.mons).map(mon=>mon.id));
    const rows=Object.entries(G.dex).filter(([id,d])=>
      (d.name.toLowerCase().includes(q)||id.includes(q))&&
      (mode==='all'||(mode==='owned'&&owned.has(id))||(mode==='seen'&&state.seen.includes(id))||
      (mode==='found'&&state.discovered.includes(id))||(mode==='missing'&&!state.seen.includes(id))))
      .sort((a,b)=>a[1].no-b[1].no);
    $('dex-count').textContent='已收录 '+state.seen.length+' / '+DEX_TOTAL;
    $('dex-list').innerHTML=rows.map(([id,d])=>'<details class="entry">'+
      (owned.has(id)?art(id,Object.values(state.mons).find(m=>m.id===id)?.shiny,true):'<span class="art small placeholder">?</span>')+
      '<summary style="flex:1">'+(d.no<10?'00':d.no<100?'0':'')+d.no+' '+d.name+
      ' · '+(d.types||[]).join('/')+' · '+
      (owned.has(id)?'持有':state.seen.includes(id)?'曾收录':state.discovered.includes(id)?'已见过':'未收录')+
      '</summary><span>'+d.rarity+'</span></details>'+
      (d.flavor?'<p class="muted" style="font-size:13px;margin:2px 0 8px">'+STAGE[d.stage]+' · '+d.genus+' · 捕获率 '+d.captureRate+' · 进化：'+(d.next.map(next=>G.dex[next].name).join('、')||'无')+'<br>'+d.flavor+'</p>':'')).join('')||'<p>没有符合条件的记录。</p>';
  }
  // ---- 商店：购买 / 卖出 / 训练 三页签 ----
  function shop() {
    const s=state;
    $('shop-wallet').textContent=s.coins.toLocaleString()+' ₽';
    document.querySelectorAll('#shop-tabs button').forEach(el=>el.classList.toggle('active',el.dataset.shop===shopTab));
    if (shopTab==='buy') {
      $('shop-list').innerHTML=Object.entries(G.items).map(([id,item])=>
        '<div class="entry"><b style="min-width:96px">'+item.name+'</b><span class="muted">'+item.price+' ₽ · 持有 '+(s.bag[id]??0)+'</span>'+
        btn('buy',id,'购买',s.cleared.length<item.gate||s.coins<item.price)+
        (id==='ration'?btn('use',id,'使用',!(s.bag[id]>0&&s.battle)):'')+
        (s.cleared.length<item.gate?'<span class="muted">需击败 '+item.gate+' 位首领</span>':'')+'</div>').join('');
    } else if (shopTab==='sell') {
      const owned=Object.entries(G.items).filter(([id])=>s.bag[id]>0);
      $('shop-list').innerHTML=owned.length?owned.map(([id,item])=>
        '<div class="entry"><b style="min-width:96px">'+item.name+'</b><span class="muted">持有 '+s.bag[id]+' · 回收价 '+Math.floor(item.price/2)+' ₽</span>'+
        btn('sell',id,'卖出 1')+'</div>').join(''):'<p class="muted">背包里没有可卖出的道具。</p>';
    } else {
      const cost=uid=>s.mons[uid].level*4;
      $('shop-list').innerHTML='<p class="muted">特训立刻结算一份大额经验，费用 = 等级 × 4 ₽。</p>'+
        s.team.filter(Boolean).map(uid=>'<div class="entry">'+art(s.mons[uid].id,s.mons[uid].shiny,true)+'<b>队伍</b> '+label(uid)+' '+btn('train',uid,'特训 '+cost(uid)+' ₽',s.coins<cost(uid)||!!s.battle)+'</div>').join('')+
        s.box.map(uid=>'<div class="entry">'+art(s.mons[uid].id,s.mons[uid].shiny,true)+'<b>仓库</b> '+label(uid)+' '+btn('train',uid,'特训 '+cost(uid)+' ₽',s.coins<cost(uid)||!!s.battle)+'</div>').join('');
    }
  }
  function pension() {
    const s=state;
    const slots=Array.from({length:G.boardMax},(_,i)=>{
      const slot=(s.board||[])[i];
      return '<div class="entry"><b>寄放位 '+(i+1)+'</b>'+(slot?label(slot.uid)+' '+btn('take',i,'取回'):'<span class="muted">空</span>')+'</div>';
    }).join('');
    $('pension-list').innerHTML=slots+
      '<p class="muted">拥有百变怪时寄放会产下一枚蛋（同版本幼年体）；没有百变怪则只提供经验加成。百变怪：'+(hasDitto()?'✅ 已拥有':'❌ 未拥有（第 8 号路线可遇到）')+'</p>'+
      (s.egg?'<div class="entry">🥚 孵化器：'+G.dex[s.egg.id].name+' · '+new Date(s.egg.at).toLocaleString()+' '+btn('egg','0','领取',Date.now()<s.egg.at)+'</div>':'')+
      '<h3 style="margin:10px 0 4px;font-size:16px">从仓库寄放</h3>'+
      (s.box.map(uid=>btn('board',uid,label(uid),(s.board||[]).length>=G.boardMax)).join(' ')||'<p class="muted">仓库为空。</p>');
  }
  function hasDitto() {
    const s=state;
    return [...s.team,...s.box,...(s.board||[]).map(b=>b.uid)].some(uid=>s.mons[uid]?.id==='p132');
  }
  function activities() {
    $('activity-list').innerHTML=Object.entries(G.activities).map(([id,a])=>
      '<div class="entry"><b style="min-width:84px">'+a.name+'</b>'+
      (id==='casino'?
        btn('casino','slots','老虎机 · 10 ₽',state.cleared.length<a.gate)+
        btn('casino','pachinko','弹珠 · 2 代币',state.cleared.length<a.gate)+
        '<span class="muted">代币 '+(state.bag.token??0)+'</span>':
        btn('activity',id,'开始',state.cleared.length<a.gate))+
      ' · 完成 '+(state.records[id]??0)+(state.cleared.length<a.gate?' · 需击败 '+a.gate+' 位主线首领':'')+'</div>').join('');
  }
  function achievements() {
    const won=G.achieved(state);
    $('ach-count').textContent='已达成 '+won.length+' / '+G.achievements.length;
    $('ach-grid').innerHTML=G.achievements.map(a=>
      '<div class="ach'+(won.includes(a.id)?' won':'')+'"><b>'+(won.includes(a.id)?'🏅 ':'🔒 ')+a.name+'</b>'+a.desc+'</div>').join('');
  }
  function record(text) {
    const row=document.createElement('div');
    row.textContent=text;
    $('log').prepend(row);
    if ($('log').children.length>30) $('log').lastElementChild.remove();
  }
  // 分块结算离线进度：每 3 万回合让出一帧，期间显示进度条，避免长时间卡死页面。
  async function settleOffline(now) {
    const overlay=$('settling-overlay'), bar=$('settle-bar'), text=$('settle-text');
    overlay.hidden=false;
    bar.value=0;
    text.textContent='正在推演离线进度…';
    const iterator=G.offlineSteps(state,now,30000);
    let step=iterator.next();
    try {
      while (!step.done) {
        const {rounds,total}=step.value;
        bar.value=Math.round(rounds/total*100);
        text.textContent='正在推演离线进度 '+rounds.toLocaleString()+' / '+total.toLocaleString()+' 回合…';
        await new Promise(resolve=>setTimeout(resolve,0));
        step=iterator.next();
      }
    } finally {
      overlay.hidden=true;
    }
    return step.value;
  }
  async function enter(resume) {
    screen='game';
    page='progress';
    paused=false;
    selected=null;
    const now=Date.now();
    if (resume&&!settling) {
      settling=true;
      stopLoop();
      try {
        const report=await settleOffline(now);
        if (report.rounds) showWelcome(report);
      } finally { settling=false; }
    }
    persist(true,Date.now());
    render();
    schedule();
  }
  // 「欢迎回来」结算面板（复刻原站金边样式）
  function showWelcome(report) {
    const minutes=Math.floor(report.credited/60000);
    $('offline-away').textContent='离开了 '+(minutes>=120?Math.round(minutes/60)+' 小时':(minutes||1)+' 分钟')+(report.truncated?'（按 72 小时上限结算）':'');
    $('off-wins').textContent=report.wins??0;
    $('off-coins').textContent='+'+report.coins.toLocaleString()+' ₽';
    $('off-catches').textContent=report.catches;
    $('off-newcount').textContent=report.newSeen?.length??0;
    $('off-newmons').innerHTML=(report.newSeen||[]).map(id=>
      '<div class="new"><i>NEW</i>'+art(id,false)+'</div>').join('');
    const extras=[];
    if (report.dupes) extras.push('重复转化 '+report.dupes+' 只');
    if (report.bosses?.length) extras.push('击败 '+report.bosses.join('、'));
    $('off-extra').textContent=extras.join(' · ');
    $('offline-overlay').hidden=false;
  }

  $('choices').innerHTML=G.starters.map(id=>btn('starter',id,art(id)+G.dex[id].name)).join('');
  $('open-save').onclick=openSave;
  $('export-save').onclick=download;
  $('save-file').onchange=async event=>{
    const file=event.target.files[0];
    event.target.value='';
    if (file) loadFrom(await file.text());
  };
  $('new-game').onclick=()=>{screen='starter';render();};
  $('back-title').onclick=()=>{screen='title';render();};
  $('box-search').oninput=team;
  $('box-order').onchange=team;
  $('dex-search').oninput=dex;
  $('dex-filter').onchange=dex;
  $('offline-go').onclick=()=>{$('offline-overlay').hidden=true;};
  $('offline-close').onclick=()=>{$('offline-overlay').hidden=true;};
  // 左侧导航
  document.getElementById('pc-side').addEventListener('click',event=>{
    const el=event.target.closest('[data-nav]');
    if (!el||!state) return;
    page=el.dataset.nav;
    notice('');
    render();
  });
  // 商店页签
  $('shop-tabs').addEventListener('click',event=>{
    const el=event.target.closest('[data-shop]');
    if (!el) return;
    shopTab=el.dataset.shop;
    shop();
  });
  document.querySelector('#pc-main').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button||button.disabled) return;
    if (button.dataset.speed&&state) state.speed=Number(button.dataset.speed);
    else if (button.id==='pause') paused=!paused;
    else if (button.id==='boss') {
      if (state.battle?.kind==='wild') G.recover(state);
      if (G.challenge(state,G.bosses[state.cleared.length]?.id)) {paused=false;record('首领挑战开始');}
    } else {
      const {action,value}=button.dataset;
      let ok=true;
      if (action==='route') ok=G.travel(state,Number(value));
      else if (action==='select') selected=value;
      else if (action==='swap') {
        ok=G.queueSwap(state,selected,value);
        if (ok&&!state.battle) G.recover(state);
        selected=null;
      } else if (action==='preset') ok=G.preset(state,Number(value),!state.presets[value]);
      else if (action==='evolve') ok=G.evolve(state,...value.split(':'));
      else if (action==='buy') ok=G.buy(state,value);
      else if (action==='sell') ok=G.sell(state,value);
      else if (action==='use') ok=G.use(state,value);
      else if (action==='train') ok=G.trainSession(state,value);
      else if (action==='board') ok=G.board(state,value,Date.now());
      else if (action==='take') ok=G.takeBack(state,Number(value));
      else if (action==='egg') ok=G.claimEgg(state,Date.now());
      else if (action==='release') {
        if (confirm('确定放生 '+name(value)+'？放生后无法找回。')) {
          ok=G.release(state,value);
          if (selected===value) selected=null;
        }
      }
      else if (action==='casino') notice(G.casino(state,value).message);
      else if (action==='activity') {
        const result=G.activity(state,value);
        notice(result.message);
        if (result.ok&&state.battle) {page='adventure';paused=false;record(result.message);}
      } else return;
      if (action!=='activity'&&action!=='casino') notice(ok?'':'当前条件未满足，请在战斗结算后重试或检查所需等级。');
    }
    persist(true);
    render();
    schedule();
  });
  $('choices').addEventListener('click',async event=>{
    const id=event.target.closest('button')?.dataset.value;
    if (!G.starters.includes(id)||(state&&!confirm('新建冒险会覆盖当前进度。继续吗？'))) return;
    state=G.create(id,Date.now());
    await pickSaveTarget();
    enter(false);
  });
  // 页面隐藏或关闭前立刻落盘；回到前台时补算后台期间可能被节流遗漏的进度。
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) { persist(true); return; }
    if (!state||screen!=='game') return;
    const gap=Date.now()-state.savedAt;
    if (gap>10000) {
      const report=G.offline(state,Date.now());
      if (report.rounds) showWelcome(report);
      persist(true); render();
    }
  });
  window.addEventListener('pagehide',()=>persist(true));
  render();
})();
