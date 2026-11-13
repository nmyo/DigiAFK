'use strict';
(() => {
  const G=DigitalGame, $=id=>document.getElementById(id);
  const SAVE_NAME='pokecatch-save.json';
  // 浏览器本地存档：整份进度序列化成 JSON 字符串存进 localStorage，
  // 刷新、关页、断网都不丢；磁盘文件是可选的额外备份。
  const LS_KEY='pc-save-v1';
  const lsRead=()=>{ try { return localStorage.getItem(LS_KEY); } catch { return null; } };
  const lsWrite=raw=>{ try { localStorage.setItem(LS_KEY,raw); return true; } catch { return false; } };
  const lsClear=()=>{ try { localStorage.removeItem(LS_KEY); } catch {} };
  let localSave=lsRead();
  let state, page='adventure', screen='title', paused=false, timer, selected=null, dexPick=null;
  let fileHandle=null, lastWrite=0, lastLocal=0, worker=null, settling=false, shopTab='buy';
  // File System Access API（Chromium 系）：可对同一个 JSON 文件自动续写。
  const hasFS=typeof window.showOpenFilePicker==='function'&&typeof window.showSaveFilePicker==='function';
  let fsUsable=hasFS;
  const status=text=>{$('saveStatus').textContent=text;};
  const notice=text=>{$('notice').textContent=text;};
  const btn=(action,value,label,disabled=false,cls='btn small')=>
    '<button class="'+cls+'" data-action="'+action+'" data-value="'+value+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
  const svg=(d)=>'<svg class="ic16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
  const I={
    sun:svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>'),
    moon:svg('<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>'),
    rain:svg('<path d="M6.5 13a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 6.5 3.8 3.8 0 0 1 17.5 14z"/><path d="M8 18v2M12 17.5v2.4M16 18v2"/>'),
    trophy:svg('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4a3 3 0 0 0 3 4.5"/><path d="M17 5h3a3 3 0 0 1-3 4.5"/><path d="M12 14v4M8 21h8"/>'),
    lock:svg('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'),
    egg:svg('<path d="M12 3c4.2 0 7 6.2 7 11a7 7 0 0 1-14 0C5 9.2 7.8 3 12 3z"/>'),
    medal:svg('<circle cx="12" cy="9" r="5.5"/><path d="M9.2 13.7 7.5 20.5 12 18l4.5 2.5-1.7-6.8"/>')
  };
  const DEX_TOTAL=Object.keys(G.dex).length;
  const STAGE=['基础','一阶','最终','传说'];
  // 宝可梦属性配色（原站 .type chip 样式，颜色沿用官方属性色）
  const TYPE_COLOR={'一般':'#A8A878','火':'#F08030','水':'#6890F0','电':'#F8D030','草':'#78C850','冰':'#98D8D8',
    '格斗':'#C03028','毒':'#A040A0','地面':'#E0C068','飞行':'#A890F0','超能力':'#F85888','虫':'#A8B820',
    '岩石':'#B8A038','幽灵':'#705898','龙':'#7038F8','恶':'#705848','钢':'#B8B8D0','妖精':'#EE99AC'};
  const typeChip=(t,sm)=>'<span class="type'+(sm?' sm':'')+'" style="--tc:'+(TYPE_COLOR[t]||'#888')+'">'+t+'</span>';
  const art=(id,shiny,style='',lazy=false)=>{
    const d=G.dex[id];
    return d?'<img alt="" '+(lazy?'loading="lazy" decoding="async" ':'')+style+' src="assets/pokemon/'+(shiny?'shiny/':'')+d.no+'.png">':
      '<span style="display:grid;place-items:center;color:var(--yellow);font-size:30px" '+style+'>?</span>';
  };
  const name=uid=>G.dex[state.mons[uid].id].name;
  const label=uid=>name(uid)+' · Lv.'+state.mons[uid].level+(state.mons[uid].shiny?' ✦':'');
  const hpCls=r=>r<=.2?'crit':r<=.5?'low':'';

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
    // 1) 浏览器本地存档：始终生效，不依赖任何文件权限
    if (force||now-lastLocal>3000) {
      if (lsWrite(raw)) { localSave=raw; lastLocal=now; status('已保存到浏览器'); }
      else status('浏览器存储不可用，请用导出备份');
    }
    // 2) 若额外绑定了磁盘文件，一并续写（可选能力）
    if (fileHandle&&(force||now-lastWrite>5000)) {
      try { await writeHandle(fileHandle,raw); lastWrite=now; status('已保存 · 浏览器 + 文件'); }
      catch { status('文件写入失败，浏览器存档不受影响'); }
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
  // 有本地存档时优先“继续”，否则走文件导入
  function openOrResume() {
    if (localSave) { resumeLocal(); return; }
    openSave();
  }
  function resumeLocal() {
    const s=G.load(localSave);
    if (!s) {
      localSave=null; lsClear();
      notice('浏览器存档无法读取，已清除；可用「打开存档文件」导入备份。');
      render(); return;
    }
    state=s;
    enter(true);
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
    $('top-coins').textContent=state.coins.toLocaleString()+' ₽';
    $('top-dex').textContent='图鉴 '+state.seen.length+'/'+DEX_TOTAL;
    const w=G.weather(Date.now());
    $('top-weather').innerHTML=(w.night?I.moon:I.sun)+' '+(w.night?'夜间':'白天')+(w.rain?' · '+I.rain+' 雨天':'');
    const route=G.routes[state.route]||'';
    $('side-chapter').textContent=route+' · '+state.routeWins[state.route]+'/3';
  }
  // 屏幕显隐：原站 CSS 用 .screen.active
  function render() {
    document.body.classList.toggle('ingame',screen==='game'&&!!state);
    const show=(id,on)=>{const el=$(id);el.hidden=!on;el.classList.toggle('active',on);};
    show('screen-title',screen==='title');
    show('screen-starter',screen==='starter');
    $('new-game').textContent=state?'新建冒险（覆盖当前进度）':'NEW GAME';
    $('open-save').textContent=localSave?'继续上次进度':'打开存档文件';
    if (screen!=='game') return;
    topbar();
    document.querySelectorAll('[data-page]').forEach(el=>{
      const on=el.id==='screen-'+page;
      el.hidden=!on;
      el.classList.toggle('active',on);
    });
    document.querySelectorAll('#tabs [data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===page));
    if (page==='progress') progress();
    if (page==='adventure') adventure();
    if (page==='team') team();
    if (page==='dex') dex();
    if (page==='shop') shop();
    if (page==='pension') pension();
    if (page==='activities') activities();
    if (page==='achievements') achievements();
    if (page==='settings') settings();
  }
  // ---- 冒险页（原站 arena 结构：hero / enemy / enemy-hud / team-rail / battle-log / adv-controls） ----
  function timeline(s) {
    const nodes=G.bosses.map((b,i)=>{
      const won=s.cleared.includes(b.id), now=i===s.cleared.length;
      return (i?'<span class="tl-link'+(won?' on':'')+'"></span>':'')+
        '<span class="tl-node gym'+(won?' on':'')+(now?' now':'')+'" title="'+b.name+'">'+(i+1)+'</span>';
    }).join('');
    $('timeline').innerHTML=nodes;
    $('tl-count').textContent=s.cleared.length+'/'+G.bosses.length+' 徽章';
  }
  function adventure() {
    const s=state,b=s.battle,mon=s.mons[s.team[s.lead]],boss=G.bosses[s.cleared.length];
    const arena=$('arena');
    arena.classList.toggle('river',s.route%2===0);
    // 我方精灵
    $('hero').innerHTML=art(mon.id,mon.shiny,'style="width:calc(68px*var(--k,4));height:calc(56px*var(--k,4));object-fit:contain;image-rendering:pixelated"');
    // 敌方
    $('enemy').innerHTML=b?'<div class="wrap">'+art(b.id,b.shiny,'style="width:calc(68px*var(--k,4));height:calc(56px*var(--k,4));object-fit:contain;image-rendering:pixelated"')+'</div>':'';
    // 敌方 HUD（原站样式：米白圆角信息卡）
    const hud=$('enemy-hud');
    if (b) {
      const d=G.dex[b.id], hpPct=Math.max(0,b.hp/G.hp({id:b.id,level:b.level}));
      hud.hidden=false;
      hud.innerHTML='<div class="row"><b>'+(b.shiny?'✦ ':'')+b.name+'</b><span>Lv.'+b.level+'</span></div>'+
        '<div class="hp"><i class="'+hpCls(hpPct)+'" style="width:'+(hpPct*100).toFixed(1)+'%"></i></div>'+
        '<div class="types">'+(d.types||[]).map(t=>typeChip(t,true)).join('')+'</div>';
    } else hud.hidden=true;
    // 队伍栏（左侧行军条）
    $('team-rail').innerHTML=s.team.map((uid,i)=>{
      if (!uid) return '';
      const m=s.mons[uid];
      return '<div class="tr-row'+(i===s.lead?' lead':'')+'" data-lead="'+i+'"><img alt="" src="assets/pokemon/'+(m.shiny?'shiny/':'')+G.dex[m.id].no+'.png"><small>'+m.level+'</small></div>';
    }).join('');
    // 顶部时间线与路线名
    $('tl-zone').textContent=G.routes[s.route];
    timeline(s);
    // 侧栏：当前路线 + 道馆挑战卡
    $('chapter-btn').textContent=G.routes[s.route]+' · '+s.routeWins[s.route]+'/3';
    $('event-card').innerHTML=boss
      ?'<h3>道馆挑战</h3><p>'+boss.name+'<br>推荐等级 Lv.'+boss.level+' · 奖励 '+(boss.reward??5+boss.level)+' ₽</p>'+
       '<button class="btn primary" id="boss" type="button"'+((s.routeWins[s.cleared.length]<3||(b&&b.kind!=='wild'))?' disabled':'')+'>挑战道馆</button>'
      :'<h3>主线通关</h3><p>已击败冠军青绿，继续探索和收集吧。</p>';
    // 速度按钮状态
    document.querySelectorAll('#speed-btns button').forEach(el=>el.classList.toggle('on',Number(el.dataset.speed)===s.speed));
    $('pause').textContent=paused?'继续':'暂停';
    // 新闻条（最近收益摘要）
    const stats=s.stats||{wins:0,catches:0};
    $('newsbar').innerHTML='<span>胜场 <b>'+stats.wins+'</b></span><span>捕获 <b>'+stats.catches+'</b></span>'+
      '<span>重复转化 <b>'+(s.dupes??0)+'</b></span><span>仓库 <b>'+s.box.length+'/'+G.boxMax+'</b></span>'+
      (s.egg?'<span>'+I.egg+' 孵化中</span>':'');
    // 右侧路线列表
    $('zone-panel').innerHTML=G.routes.map((r,i)=>{
      const locked=i>s.cleared.length, done=s.routeWins[i]>=3&&i<s.cleared.length;
      return '<div class="entry"><b style="min-width:76px">'+r+'</b>'+
        '<span class="muted">'+s.routeWins[i]+'/3</span>'+
        '<span>'+(i===s.route?'<b style="color:var(--gold-soft)">当前位置</b>':locked?I.lock+' 未解锁':done?I.trophy+' 已通关':'')+'</span>'+
        btn('route',i,'前往',locked||i===s.route||!!s.battle)+'</div>';
    }).join('');
    // 右侧背包
    const bag=Object.entries(G.items).filter(([id])=>s.bag[id]>0);
    $('bag-panel').innerHTML=(bag.length?bag.map(([id,item])=>
      '<div class="entry"><b>'+item.name+'</b><span class="muted">×'+s.bag[id]+'</span>'+
      (id==='ration'?btn('use',id,'使用',!(s.battle)):btn('sell',id,'卖出',false))+'</div>').join(''):'<div class="entry muted">背包是空的，去商店采购吧。</div>');
  }
  // ---- 进度页 ----
  function progress() {
    const s=state;
    const pct=Math.round(s.cleared.length/G.bosses.length*100);
    $('prog-bar').value=pct;
    $('prog-sum').innerHTML='<span>徽章 <b>'+s.cleared.length+'/'+G.bosses.length+'</b></span><span>图鉴 <b>'+
      s.seen.length+'/'+DEX_TOTAL+'</b></span><span>胜场 <b>'+(s.stats?.wins??0)+'</b></span>';
    const ball='<svg viewBox="0 0 60 60" width="26" height="26" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="#fff" stroke="#1b1b22" stroke-width="4"/><path d="M4 30h18M38 30h18" stroke="#1b1b22" stroke-width="4"/><circle cx="30" cy="30" r="9" fill="#fff" stroke="#1b1b22" stroke-width="4"/><path d="M4 30a26 26 0 0 1 52 0z" fill="#e3353b" stroke="#1b1b22" stroke-width="0"/></svg>';
    const empty='<svg viewBox="0 0 60 60" width="26" height="26" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M4 30h52" stroke="currentColor" stroke-width="4"/><circle cx="30" cy="30" r="9" fill="none" stroke="currentColor" stroke-width="4"/></svg>';
    $('badge-wall').innerHTML=G.bosses.map((b,i)=>
      '<div class="badge'+(s.cleared.includes(b.id)?' won':'')+'"><div class="bicon">'+
      (s.cleared.includes(b.id)?ball:empty)+
      '</div>'+b.name.split(' · ')[1]+'</div>').join('');
    $('route-list').innerHTML=G.routes.map((r,i)=>{
      const locked=i>s.cleared.length, done=s.routeWins[i]>=3&&i<s.cleared.length;
      return '<div class="entry"><b style="min-width:84px">'+r+'</b>'+
        '<span class="muted">获胜 '+s.routeWins[i]+'/3</span>'+
        '<span>'+(i===s.route?'<b style="color:var(--gold-soft)">当前位置</b>':locked?I.lock+' 未解锁':done?I.trophy+' 已通关':'')+'</span>'+
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
  // ---- 队伍页（原站 team-slots + pc-grid 结构） ----
  function slotHTML(i,uid) {
    const s=state;
    if (!uid) return '<div class="slot empty" data-slot="'+i+'"><span>空位</span><small>从电脑选择宝可梦</small></div>';
    const m=s.mons[uid], d=G.dex[m.id];
    return '<div class="slot filled'+(selected===uid?' selected':'')+'" data-uid="'+uid+'" data-slot="'+i+'">'+
      '<div class="slot-types">'+(d.types||[]).map(t=>typeChip(t,true)).join('')+'</div>'+
      art(m.id,m.shiny,'style="width:92px;height:80px;object-fit:contain;image-rendering:pixelated"')+
      '<div class="name">'+d.name+(m.shiny?' ✦':'')+'</div><div class="lv">Lv.'+m.level+' · HP '+G.hp(m)+'</div></div>';
  }
  function opsHTML(uid) {
    const s=state;
    if (!uid) return '<span class="muted">点击队伍成员查看操作；点击仓库成员可与选中的成员交换。</span>';
    const mon=s.mons[uid], form=G.dex[mon.id], level=[16,32][form.stage]??Infinity;
    return '<span class="muted">已选中：</span><b>'+label(uid)+'</b>'+
      form.next.map(id=>btn('evolve',uid+':'+id,'进化 → '+G.dex[id].name+'（Lv.'+level+'）',!!s.battle||mon.level<level)).join('')+
      btn('train',uid,'特训 '+(mon.level*4)+' ₽',s.coins<mon.level*4||!!s.battle)+
      btn('select',uid,'设为首发',!!s.battle)+
      btn('release',uid,'放生',false)+
      '<button class="btn small ghost" data-action="deselect">取消选择</button>';
  }
  function team() {
    const s=state, q=$('box-search').value.trim().toLowerCase(), order=$('box-order').value;
    const avg=Math.round(s.team.filter(Boolean).reduce((a,uid)=>a+s.mons[uid].level,0)/Math.max(1,s.team.filter(Boolean).length));
    $('team-sum').innerHTML='<span>平均等级 <b>'+(s.team.filter(Boolean).length?avg:'—')+'</b></span>'+
      '<span>'+(s.swap?'已排队换人，等待战斗结算':'点击队员后可进化 / 特训 / 放生')+'</span>';
    $('team-list').innerHTML=Array.from({length:6},(_,i)=>slotHTML(i,s.team[i])).join('');
    $('slot-ops').innerHTML=opsHTML(selected);
    $('box-count').textContent='仓库 '+s.box.length+' / '+G.boxMax+(s.box.length>=G.boxMax?' · 已满':'');
    const ids=s.box.filter(uid=>name(uid).toLowerCase().includes(q)).reverse();
    if (order==='level') ids.sort((a,b)=>s.mons[b].level-s.mons[a].level);
    if (order==='name') ids.sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));
    $('box').innerHTML=ids.map(uid=>{
      const m=s.mons[uid];
      return '<div class="pc-cell'+(selected===uid?' selected':'')+'" data-uid="'+uid+'" title="'+label(uid)+'">'+
        art(m.id,m.shiny,'',true)+'<span class="lvl">Lv.'+m.level+(m.shiny?' ✦':'')+'</span></div>';
    }).join('')||'<div class="pc-empty">没有符合条件的伙伴。</div>';
  }
  // ---- 图鉴页（原站 dex-grid + dex-cell 结构） ----
  function dex() {
    const s=state, q=$('dex-search').value.trim().toLowerCase(), mode=$('dex-filter').value;
    const owned=new Set(Object.values(s.mons).map(mon=>mon.id));
    const rows=Object.entries(G.dex).filter(([id,d])=>
      (d.name.toLowerCase().includes(q)||id.includes(q)||String(d.no).includes(q))&&
      (mode==='all'||(mode==='owned'&&owned.has(id))||(mode==='seen'&&s.seen.includes(id))||
      (mode==='found'&&s.discovered.includes(id))||(mode==='missing'&&!s.seen.includes(id))))
      .sort((a,b)=>a[1].no-b[1].no);
    $('dex-count').innerHTML='<span>已收录 <b>'+s.seen.length+'/'+DEX_TOTAL+'</b></span><span>持有 <b>'+owned.size+'</b></span>';
    $('dex-list').innerHTML=rows.map(([id,d])=>{
      const isOwned=owned.has(id), seen=s.seen.includes(id);
      const cls='dex-cell'+(isOwned?' caught':seen?' seen':' unknown');
      const shiny=Object.values(s.mons).find(m=>m.id===id)?.shiny;
      const isNew=!s.discovered.includes(id)&&seen&&!isOwned;
      return '<div class="'+cls+'" data-dex="'+id+'" title="#'+d.no+' '+d.name+'">'+
        (isNew?'<span class="new">NEW</span>':'')+
        '<span class="num">'+String(d.no).padStart(3,'0')+'</span>'+
        art(id,shiny&&isOwned,'',true)+'<div class="nm">'+(seen?d.name:'？？？')+'</div></div>';
    }).join('')||'<div class="pc-empty">没有符合条件的记录。</div>';
    // 详情面板
    const info=$('dex-info');
    if (dexPick&&G.dex[dexPick]) {
      const d=G.dex[dexPick];
      info.hidden=false;
      info.innerHTML='<b>#'+String(d.no).padStart(3,'0')+' '+d.name+'</b> · '+STAGE[d.stage]+' · '+d.genus+'<br>'+
        (d.types||[]).map(t=>typeChip(t)).join(' ')+' · 捕获率 '+d.captureRate+' · '+d.rarity+
        ' · 进化：'+(d.next.map(next=>G.dex[next].name).join(' → ')||'无')+
        (d.flavor?'<br><span class="muted">'+d.flavor+'</span>':'');
    } else info.hidden=true;
  }
  // ---- 商店（原站 shop-panel 结构，买/卖/训练分区） ----
  function shop() {
    const s=state;
    $('shop-wallet').innerHTML='<b>'+s.coins.toLocaleString()+' ₽</b>';
    document.querySelectorAll('#shop-tabs button').forEach(el=>el.classList.toggle('active',el.dataset.shop===shopTab));
    const card=(title,sub,price,actions)=>'<div class="shop-card"><b>'+title+'</b><small>'+sub+'</small>'+
      '<div class="row"><span class="price">'+price+'</span><span>'+actions+'</span></div></div>';
    if (shopTab==='buy') {
      $('shop-list').innerHTML='<div class="shop-cat"><h3>道具</h3><div class="shop-grid">'+
        Object.entries(G.items).map(([id,item])=>
          card(item.name,'持有 '+(s.bag[id]??0)+' · '+(s.cleared.length<item.gate?'需击败 '+item.gate+' 位首领':'随时可购'),item.price+' ₽',
            btn('buy',id,'购买',s.cleared.length<item.gate||s.coins<item.price)+
            (id==='ration'&&s.battle?btn('use',id,'使用',!(s.bag[id]>0)):''))).join('')+
        '</div></div><div class="shop-cat"><h3>提示</h3><small class="muted">伤药可在冒险页背包中随时使用；重复捕获会自动转化为金币，因此道具主要服务于道馆战。</small></div>';
    } else if (shopTab==='sell') {
      const ownedItems=Object.entries(G.items).filter(([id])=>s.bag[id]>0);
      $('shop-list').innerHTML=ownedItems.length
        ?'<div class="shop-cat"><h3>回收（半价）</h3><div class="shop-grid">'+ownedItems.map(([id,item])=>
            card(item.name,'持有 '+s.bag[id]+' · 回收价 '+Math.floor(item.price/2)+' ₽',Math.floor(item.price/2)+' ₽',btn('sell',id,'卖出 1'))).join('')+'</div></div>'
        :'<div class="shop-cat"><h3>回收（半价）</h3><small class="muted">背包里没有可卖出的道具。</small></div>';
    } else {
      const cost=uid=>s.mons[uid].level*4;
      const mon=(uid,where)=>{const m=s.mons[uid];
        return '<div class="shop-card">'+art(m.id,m.shiny,'style="width:64px;height:56px;object-fit:contain;image-rendering:pixelated;align-self:center"')+
        '<b>'+G.dex[m.id].name+(m.shiny?' ✦':'')+'</b><small>'+where+' · Lv.'+m.level+'</small>'+
        '<div class="row"><span class="price">'+cost(uid)+' ₽</span>'+btn('train',uid,'特训',s.coins<cost(uid)||!!s.battle)+'</div></div>';};
      $('shop-list').innerHTML='<div class="shop-cat"><h3>特训（立刻结算一份大额经验，费用 = 等级 × 4）</h3><div class="shop-grid">'+
        s.team.filter(Boolean).map(uid=>mon(uid,'队伍')).join('')+
        s.box.map(uid=>mon(uid,'仓库')).join('')+'</div></div>';
    }
  }
  function pension() {
    const s=state;
    const slots=Array.from({length:G.boardMax},(_,i)=>{
      const slot=(s.board||[])[i];
      return '<div class="entry"><b>寄放位 '+(i+1)+'</b>'+(slot?label(slot.uid)+' '+btn('take',i,'取回'):'<span class="muted">空</span>')+'</div>';
    }).join('');
    $('pension-list').innerHTML=slots+
      '<p class="muted">拥有百变怪时寄放会产下一枚蛋（同版本幼年体）；没有百变怪则只提供经验加成。百变怪：'+(hasDitto()?'<b style=\'color:var(--green)\'>已拥有</b>':'<b style=\'color:var(--red)\'>未拥有</b>（第 8 号路线可遇到）')+'</p>'+
      (s.egg?'<div class="entry">'+I.egg+' 孵化器：'+G.dex[s.egg.id].name+' · '+new Date(s.egg.at).toLocaleString()+' '+btn('egg','0','领取',Date.now()<s.egg.at)+'</div>':'')+
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
      '<div class="ach'+(won.includes(a.id)?' won':'')+'"><b>'+(won.includes(a.id)?I.medal+' ':I.lock+' ')+a.name+'</b>'+a.desc+'</div>').join('');
  }
  // ---- 设置页 ----
  function settings() {
    $('set-speed').innerHTML=[1,2,3].map(v=>
      '<button data-set-speed="'+v+'" class="'+(state.speed===v?'on':'')+'">×'+v+'</button>').join('');
    const theme=document.documentElement.dataset.theme||'dark';
    $('set-theme').innerHTML=[['dark','深色'],['light','浅色']].map(([v,l])=>
      '<button data-set-theme="'+v+'" class="'+(theme===v?'on':'')+'">'+l+'</button>').join('');
    $('set-worker').textContent=worker?'运行中':'备用计时器';
    const kb=localSave?(localSave.length/1024).toFixed(1)+' KB':'—';
    $('set-file').textContent=localSave
      ? '浏览器本地存档 '+kb+(fileHandle?'，另绑定 '+fileHandle.name:'')+'，每次推进自动保存'
      : '尚无本地存档，开始游戏后自动生成';
  }
  function applyTheme(theme) {
    document.documentElement.dataset.theme=theme;
    try { localStorage.setItem('pc-theme',theme); } catch {}
  }
  try { document.documentElement.dataset.theme=localStorage.getItem('pc-theme')||'dark'; } catch {}

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
    page='adventure';
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
    $('off-loss').textContent='—';
    $('off-newcount').textContent=report.newSeen?.length??0;
    $('off-newmons').innerHTML=(report.newSeen||[]).slice(0,8).map(id=>
      '<div class="new"><i>NEW</i>'+art(id,false)+'</div>').join('');
    const extras=[];
    if (report.catches) extras.push('捕获 '+report.catches+' 只');
    if (report.dupes) extras.push('重复转化 '+report.dupes+' 只');
    if (report.bosses?.length) extras.push('击败 '+report.bosses.join('、'));
    $('off-extra').textContent=extras.join(' · ')||'—';
    $('offline-overlay').hidden=false;
  }

  $('choices').innerHTML=G.starters.map(id=>btn('starter',id,art(id)+'<span style="margin-left:6px">'+G.dex[id].name+'</span>')).join('');
  $('open-save').onclick=openOrResume;
  $('open-settings').onclick=()=>{ if (!state) { notice('请先开始或打开存档。'); return; } page='settings'; render(); };
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
  $('side-chapter').onclick=()=>{ if (state&&screen==='game') { page='adventure'; render(); } };
  // 左侧导航
  document.getElementById('tabs').addEventListener('click',event=>{
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
  document.querySelector('main').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button||button.disabled) return;
    // 设置页
    if (button.dataset.setSpeed&&state) {
      state.speed=Number(button.dataset.setSpeed);
      notice('速度已设为 ×'+state.speed);
      persist(true); render(); schedule(); return;
    }
    if (button.dataset.setTheme) { applyTheme(button.dataset.setTheme); render(); return; }
    if (button.id==='set-export') { download(); return; }
    if (button.id==='set-open') { openSave(); return; }
    if (button.id==='set-new') { screen='starter'; render(); return; }
    if (button.id==='set-wipe') {
      if (confirm('清空当前进度并回到标题页？此操作无法撤销，建议先导出存档。')) {
        stopLoop();
        state=null; fileHandle=null; localSave=null; lsClear(); screen='title'; page='adventure'; lastWrite=0; lastLocal=0;
        status('进度已清空');
        render();
      }
      return;
    }
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
      else if (action==='deselect') selected=null;
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
  // 队伍/图鉴的点击式选择（pc-cell、slot、dex-cell）
  document.querySelector('main').addEventListener('click',event=>{
    const cell=event.target.closest('.pc-cell[data-uid]');
    if (cell) {
      const uid=cell.dataset.uid;
      if (selected&&selected!==uid) {
        const ok=G.queueSwap(state,selected,uid);
        if (ok&&!state.battle) G.recover(state);
        selected=null;
        notice(ok?'':'换队条件未满足。');
        persist(true); render(); schedule();
      } else {
        selected=selected===uid?null:uid;
        team();
      }
      return;
    }
    const slot=event.target.closest('.slot.filled[data-uid]');
    if (slot) { selected=selected===slot.dataset.uid?null:slot.dataset.uid; team(); return; }
    const dexCell=event.target.closest('.dex-cell[data-dex]');
    if (dexCell) { dexPick=dexPick===dexCell.dataset.dex?null:dexCell.dataset.dex; dex(); return; }
    const lead=event.target.closest('.tr-row[data-lead]');
    if (lead) { state.lead=Number(lead.dataset.lead); render(); }
  });
  $('choices').addEventListener('click',async event=>{
    const id=event.target.closest('button')?.dataset.value;
    if (!G.starters.includes(id)||(state&&!confirm('新建冒险会覆盖当前进度。继续吗？'))) return;
    if (state&&state.team?.length&&!localSave) persist(true);
    state=G.create(id,Date.now());
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
