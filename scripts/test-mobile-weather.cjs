// Run with a local site on :8765 and an isolated Chrome debugging port on :9222.
const assert = require('node:assert/strict');
(async () => {
  const browser = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const ws = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0, session, context;
  const pending = new Map();
  ws.onmessage = ({data}) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  async function send(method, params = {}, target = session) {
    const result = await new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({id:n,method,params,...(target ? {sessionId:target} : {})})); });
    assert.ifError(result.error && new Error(JSON.stringify(result.error)));
    return result.result;
  }
  try {
    context = (await send('Target.createBrowserContext', {disposeOnDetach:true})).browserContextId;
    const target = (await send('Target.createTarget', {url:'about:blank',browserContextId:context})).targetId;
    session = (await send('Target.attachToTarget', {targetId:target,flatten:true})).sessionId;
    await send('Emulation.setDeviceMetricsOverride', {width:320,height:700,deviceScaleFactor:1,mobile:true});
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', {url:'http://127.0.0.1:8765/'});
    await new Promise(resolve => setTimeout(resolve, 6000));
    const result = await send('Runtime.evaluate', {returnByValue:true,expression:`(() => {
      const arena=document.createElement('div'); arena.className='arena'; arena.style.cssText='position:relative;width:320px;height:200px';
      arena.innerHTML='<div class="scene-bar"><span class="sb-pill sb-sky"><span>☀</span><span class="sb-clock">12:30</span><span class="sb-sep sb-now"></span><span class="sb-now">🌧</span><span class="sb-wx sb-now"><span class="sb-wn">暴风雨</span> <span class="sb-wu">持续 59 分钟</span></span><span class="sb-sep"></span><span>🌊</span><span class="sb-wx sb-tide"><span class="sb-wn">涨潮</span> <span class="sb-wu">还有 59 分钟</span></span></span></div>';
      document.body.appendChild(arena);
      const pill=arena.querySelector('.sb-pill'), p=pill.getBoundingClientRect();
      return {width:innerWidth, pill:[p.left,p.right,p.bottom], spans:[...arena.querySelectorAll('.sb-wu')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.bottom,e.scrollWidth,e.clientWidth]})};
    })()`});
    assert.equal(result.exceptionDetails, undefined);
    const {width,pill,spans} = result.result.value;
    for (const [left,right,bottom,scroll,client] of spans) {
      assert(left >= pill[0] && right <= pill[1] + 1 && right <= width && bottom <= pill[2] + 1, 'duration must fit inside mobile pill and viewport');
      assert(scroll <= client, 'duration text must not be clipped');
    }
    console.log('Mobile weather and tide durations fit at 320px.');
  } finally { if (context) await send('Target.disposeBrowserContext', {browserContextId:context}, null); ws.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
