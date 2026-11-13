'use strict';
(() => {
  const G=DigitalGame, $=id=>document.getElementById(id);
  const SAVE_NAME='digiafk-save.json';
  let state, page='adventure', screen='title', paused=false, timer, selected;
  let fileHandle=null, lastWrite=0, worker=null, settling=false;
  // File System Access API（Chromium 系）：可对同一个 JSON 文件自动续写。
  const hasFS=typeof window.showOpenFilePicker==='function'&&typeof window.showSaveFilePicker==='function';
  let fsUsable=hasFS;
  const status=text=>{$('saveStatus').textContent=text;};
  const notice=text=>{$('notice').textContent=text;};
  const btn=(action,value,label,disabled=false)=>
    '<button class="btn small" data-action="'+action+'" data-value="'+value+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
  const spriteMap={agumon:'agumon',palmon:'palmon',gabumon:'gabumon',elecmon:'elecmon',betamon:'betamon'};
  const art=id=>spriteMap[id]?'<img class="art" alt="" src="assets/digimon/'+spriteMap[id]+'.png">':
    '<span class="art placeholder" aria-hidden="true">◇</span>';
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
        status('已自动保存到 '+SAVE_NAME+'。');
      } catch { status('存档文件写入失败，请重新打开或点击“导出存档”。'); }
    } else if (!fileHandle) {
      status(fsUsable?'进度仅在本页内存中，请点击“导出存档”保存为 JSON 文件。'
                     :'当前浏览器不支持自动写文件，请定期点击“导出存档”备份进度。');
    }
  }
  async function pickSaveTarget() {
    if (!fsUsable) return false;
    try {
      fileHandle=await window.showSaveFilePicker({suggestedName:SAVE_NAME,
        types:[{description:'数码图鉴存档',accept:{'application/json':['.json']}}]});
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
    status('已导出 '+SAVE_NAME+'，可用“打开存档文件”导入。');
  }
  function loadFrom(text) {
    const s=G.load(text);
    if (!s) { status('存档文件无法读取或已损坏。'); return; }
    state=s;
    enter(true);
  }
  async function openSave() {
    if (!fsUsable) { $('save-file').click(); return; }
    try {
      const [handle]=await window.showOpenFilePicker({types:
        [{description:'数码图鉴存档',accept:{'application/json':['.json']}}]});
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
    if (page==='adventure') render();
    else $('summary').textContent='图鉴 '+state.seen.length+' / 70 · '+state.coins+' 数码币';
  }

  function render() {
    $('title-screen').hidden=screen!=='title';
    $('new-game').textContent=state?'新建冒险（覆盖当前进度）':'新建冒险';
    $('starter').hidden=screen!=='starter';
    $('game').hidden=screen!=='game';
    if (screen!=='game') return;
    $('summary').textContent='图鉴 '+state.seen.length+' / 70 · '+state.coins+' 数码币';
    document.querySelectorAll('[data-page]').forEach(el=>{el.hidden=el.id!==page;});
    document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.tab===page));
    if (page==='adventure') adventure();
    if (page==='team') team();
    if (page==='dex') dex();
    if (page==='shop') shop();
    if (page==='pension') pension();
    if (page==='activities') activities();
  }
  function fighter(id,title,level,health) {
    return art(id)+'<strong>'+title+'</strong><br><small>Lv.'+level+' · HP '+health+'</small>';
  }
  function adventure() {
    const s=state,b=s.battle,mon=s.mons[s.team[s.lead]],boss=G.bosses[s.cleared.length];
    $('campaign-complete').hidden=!s.cleared.includes('apocalymon');
    $('scene').classList.toggle('river',s.route%2===0);
    $('ally').innerHTML=fighter(mon.id,G.dex[mon.id].name,mon.level,b?.allyHp??G.hp(mon));
    $('enemy').innerHTML=b?fighter(b.id,b.name,b.level,b.hp):'<small>搜寻踪迹中…</small>';
    $('routes').innerHTML=G.routes.map((r,i)=>btn('route',i,r+' '+s.routeWins[i]+'/3',i>s.cleared.length||i===s.route||!!b)).join('');
    $('boss').textContent=boss?'挑战 '+boss.name:'主线已通关';
    $('boss').disabled=!boss||s.routeWins[s.cleared.length]<3||(b&&b.kind!=='wild');
    $('pause').textContent=paused?'继续':'暂停';
    document.querySelectorAll('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',Number(el.dataset.speed)===s.speed));
  }
  function evolutions(uid) {
    const mon=state.mons[uid];
    const form=G.dex[mon.id], level=[6,9,15,28][form.stage];
    return form.next.map(id=>btn('evolve',uid+':'+id,
      G.dex[id].name+' · Lv.'+level+(form.stage===3?' + 芯片':''),
      !!state.battle||mon.level<level||(form.stage===3&&!(state.bag['evolution-chip']>0)))).join(' ');
  }
  function team() {
    const s=state, q=$('box-search').value.trim().toLowerCase(), order=$('box-order').value;
    $('box-count').textContent='仓库 '+s.box.length+' / '+G.boxMax+(s.box.length>=G.boxMax?' · 已满，新物种将折算':'')+
      ' · 重复转化 '+(s.dupes??0)+' 只';
    $('presets').innerHTML=s.presets.map((ids,i)=>btn('preset',i,(ids?'读取 ':'保存 ')+(i+1),!!s.battle)).join('');
    $('team-list').innerHTML=Array.from({length:6},(_,i)=>{
      const uid=s.team[i];
      return '<div class="entry">'+(uid?btn('select',uid,(selected===uid?'✓ ':'')+label(uid))+' '+evolutions(uid):'空槽')+'</div>';
    }).join('')+(s.swap?'<p>已排队，等待战斗结算。</p>':'');
    const ids=s.box.filter(uid=>name(uid).toLowerCase().includes(q)).reverse();
    if (order==='level') ids.sort((a,b)=>s.mons[b].level-s.mons[a].level);
    if (order==='name') ids.sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));
    $('box').innerHTML=ids.map(uid=>'<div class="entry">'+btn('swap',uid,label(uid),!selected)+' '+evolutions(uid)+' '+btn('release',uid,'放生')+'</div>').join('')||'<p>没有符合条件的伙伴。</p>';
  }
  function dex() {
    const q=$('dex-search').value.trim().toLowerCase(), mode=$('dex-filter').value;
    const owned=new Set(Object.values(state.mons).map(mon=>mon.id));
    $('dex-list').innerHTML=Object.entries(G.dex).filter(([id,d])=>
      (d.name.toLowerCase().includes(q)||id.includes(q))&&
      (mode==='all'||(mode==='owned'&&owned.has(id))||(mode==='seen'&&state.seen.includes(id))||
      (mode==='found'&&state.discovered.includes(id))||(mode==='missing'&&!state.seen.includes(id))))
      .map(([id,d])=>'<details class="entry"><summary>'+d.name+' · Ver.'+d.version+' · '+
        (owned.has(id)?'持有':state.seen.includes(id)?'曾收录':state.discovered.includes(id)?'已见过':'未收录')+
        '</summary><p>'+['幼年期 I','幼年期 II','成长期','成熟期','完全体'][d.stage]+
        ' · 进化：'+(d.next.map(next=>G.dex[next].name).join('、')||'无')+'</p></details>').join('');
  }
  function shop() {
    $('shop-list').innerHTML=Object.entries(G.items).map(([id,item])=>
      '<div class="entry">'+item.name+' · '+item.price+' 数码币 · 持有 '+(state.bag[id]??0)+' '+
      btn('buy',id,'购买',state.cleared.length<item.gate||state.coins<item.price)+
      (id==='ration'?btn('use',id,'使用',!(state.bag[id]>0&&state.battle)):'')+'</div>').join('');
  }
  function pension() {
    const s=state;
    $('pension-list').innerHTML=(s.boarded?'<p>寄放中：'+label(s.boarded.uid)+' '+btn('take','0','取回')+'</p>':
      '<p>从仓库选择伙伴寄放，可获得经验并孵化同版本幼年体。</p>'+s.box.map(uid=>btn('board',uid,label(uid),!!s.egg)).join(' '))+
      (s.egg?'<p>孵化器：'+G.dex[s.egg.id].name+' · '+new Date(s.egg.at).toLocaleString()+' '+
       btn('egg','0','领取',Date.now()<s.egg.at)+'</p>':'');
  }
  function activities() {
    $('activity-list').innerHTML=Object.entries(G.activities).map(([id,a])=>
      '<div class="entry">'+(id==='casino'?
        btn('casino','slots','老虎机 · 10 数码币',state.cleared.length<a.gate)+
        btn('casino','pachinko','弹珠 · 2 代币',state.cleared.length<a.gate)+
        ' · 代币 '+(state.bag.token??0):btn('activity',id,a.name,state.cleared.length<a.gate))+
      ' · 完成 '+(state.records[id]??0)+(state.cleared.length<a.gate?' · 需击败 '+a.gate+' 位主线首领':'')+'</div>').join('');
  }
  function record(text) {
    const row=document.createElement('div');
    row.textContent=text;
    $('log').prepend(row);
    if ($('log').children.length>30) $('log').lastElementChild.remove();
  }
  // 分块结算离线进度：每 3 万回合让出一帧，期间显示进度条，避免长时间卡死页面。
  async function settleOffline(now) {
    const overlay=$('offline-overlay'), bar=$('offline-bar'), text=$('offline-text');
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
        if (report.rounds) {
          const minutes=Math.floor(report.credited/60000);
          const span=minutes>=120?Math.round(minutes/60)+' 小时':(minutes||1)+' 分钟';
          record('离线推进 '+span+' · +'+report.coins+' 数码币 · 捕获 '+report.catches+' 只'+
            (report.dupes?' · 重复转化 '+report.dupes+' 只':'')+
            (report.bosses.length?' · 击败 '+report.bosses.join('、'):'')+
            (report.truncated?' · 超过 72 小时，按上限结算':''));
        }
      } finally { settling=false; }
    }
    persist(true,Date.now());
    render();
    schedule();
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
  document.querySelector('#game').addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button||button.disabled) return;
    if (button.dataset.tab) {page=button.dataset.tab;notice('');render();return;}
    if (button.dataset.speed) state.speed=Number(button.dataset.speed);
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
      else if (action==='use') ok=G.use(state,value);
      else if (action==='board') ok=G.board(state,value,Date.now());
      else if (action==='take') ok=G.takeBack(state);
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
      if (report.rounds) record('后台补算 '+Math.floor(report.elapsed/1000)+' 秒 · +'+report.coins+' 数码币 · 捕获 '+report.catches+' 只');
      persist(true); render();
    }
  });
  window.addEventListener('pagehide',()=>persist(true));
  render();
})();
