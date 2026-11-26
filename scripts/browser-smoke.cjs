const assert = require('node:assert/strict');
async function main() {
  const browser = await (await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(5000) })).json();
  const socket = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("WebSocket connect timeout")), 5000); socket.onopen = () => { clearTimeout(timer); resolve(); }; socket.onerror = reject; });
  let send;
  let browserContextId;
  let sessionId;
  try {
  let id = 0;
  const exceptions = [];
  const consoleErrors = [];
  const resourceFailures = [];
  const requests = new Map();
  let checkResources = true;
  // Player artwork can be loaded by Image or fetch (for frame decoding).
  const critical = (url, type) => ['Document', 'Script', 'Stylesheet'].includes(type) || /\/assets\/(?:bg\/scenes|pokemon\/art|trainers)\//.test(new URL(url).pathname);
  const pending = new Map();
  socket.onmessage = ({ data }) => { const msg = JSON.parse(data); const p = msg.params; if (msg.method === 'Network.requestWillBeSent') requests.set(p.requestId, {url:p.request.url, type:p.type}); if (checkResources && msg.method === 'Network.responseReceived' && p.response.status >= 400 && critical(p.response.url, p.type)) resourceFailures.push(`${p.response.status} ${p.response.url}`); if (checkResources && msg.method === 'Network.loadingFailed') { const request = requests.get(p.requestId); if (request && critical(request.url, request.type) && !p.canceled) resourceFailures.push(`${p.errorText} ${request.url}`); } if (msg.method === "Runtime.consoleAPICalled" && p.type === "error") consoleErrors.push(p.args.map(x => x.description || x.value).join(" ")); if (msg.method === "Runtime.exceptionThrown") exceptions.push(p.exceptionDetails.text); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
  send = async (method, params = {}, targetSession = sessionId) => {
    const response = await new Promise((resolve) => { const n = ++id; const timer = setTimeout(() => { pending.delete(n); resolve({error: new Error(`${method} timeout`)}); }, 5000); pending.set(n, msg => { clearTimeout(timer); resolve(msg); }); socket.send(JSON.stringify({ id: n, method, params, ...(targetSession ? {sessionId: targetSession} : {}) })); });
    assert.ifError(response.error);
    if (method === 'Runtime.evaluate') assert.equal(response.result.exceptionDetails, undefined, JSON.stringify(response.result.exceptionDetails));
    return response;
  };
  browserContextId = (await send('Target.createBrowserContext', { disposeOnDetach: true })).result.browserContextId;
  const targetId = (await send('Target.createTarget', { url: 'about:blank', browserContextId })).result.targetId;
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true })).result.sessionId;
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8765/" });
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const result = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const battle = document.querySelector('#battle-log');
    const feed = document.querySelector('#newsbar .news-feed');
    const button = document.querySelector('#save-btn');
    const saved = localStorage.getItem('gachamon-save-v1');
    battle.textContent = 'smoke-test battle';
    return { eco: JSON.parse(localStorage.getItem('pokecatch-perf')), button: !!button, saved: !!saved, feed: !!feed };
  })()` });
  const state = result.result.result.value;
  const titleControls = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {const a=document.querySelector('.ti-how-btn'),b=document.querySelector('.ti-cl-btn'),c=document.querySelector('.ti-go');return {how:a && getComputedStyle(a).display,changes:b && getComputedStyle(b).display,start:c && getComputedStyle(c).display}})()` });
  assert.equal(titleControls.result.result.value.how, null);
  assert.equal(titleControls.result.result.value.changes, null);
  assert.notEqual(titleControls.result.result.value.start, 'none');
  assert.equal(state.eco.calm, true);
  assert.equal(state.button, false);
  assert.equal(state.feed, true);
  const nav = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {const trade=document.querySelector('[data-screen="trade"]');return {tradeVisible:!!trade && !!trade.getClientRects().length, social:!!document.querySelector('[data-grp="social"]'), achievements:!!document.querySelector('[data-screen="achievements"],#screen-achievements')}})()` });
  assert.equal(nav.result.result.value.tradeVisible, false);
  assert.equal(nav.result.result.value.social, false);
  assert.equal(nav.result.result.value.achievements, false);
  const guide = await send('Runtime.evaluate', { returnByValue: true, expression: `document.querySelector('#guide-btn') === null` });
  assert.equal(guide.result.result.value, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const log = await send('Runtime.evaluate', { returnByValue: true, expression: `document.querySelector('#newsbar .news-feed').textContent` });
  assert.match(log.result.result.value, /smoke-test battle/);
  await send('Runtime.evaluate', { expression: `document.querySelector('#battle-log').textContent = 'smoke-test second battle'` });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const count = await send('Runtime.evaluate', { returnByValue: true, expression: `document.querySelectorAll('#newsbar .news-feed .news-line').length` });
  assert.ok(count.result.result.value <= 40);
  for (let i = 0; i < 45; i++) {
    await send('Runtime.evaluate', { expression: `document.querySelector('#battle-log').textContent = 'battle ${i}'` });
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const history = await send('Runtime.evaluate', { returnByValue: true, expression: `Array.from(document.querySelectorAll('#newsbar .news-feed .news-line'), x => x.textContent)` });
  assert.equal(history.result.result.value.length, 40);
  assert.equal(history.result.result.value[39], 'battle 44');
  await send('Runtime.evaluate', { expression: `(() => { const el=document.querySelector('.ti-go'); if(!el) throw Error('start missing'); el.click(); })()` });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await send('Runtime.evaluate', { expression: `(() => { const el=document.querySelector('.lab-skip'); if(!el) throw Error('skip missing'); el.click(); })()` });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await send('Runtime.evaluate', { expression: `(() => { const avatar=document.querySelector('.lab-av[data-k="leaf"]'), ok=document.querySelector('.lab-ok'); if(!avatar||!ok) throw Error('trainer controls missing'); avatar.click(); ok.click(); })()` });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await send('Runtime.evaluate', { expression: `(() => { const form=document.querySelector('.lab-name'); if(!form) throw Error('name form missing'); form.requestSubmit(); })()` });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const save = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {const s=localStorage.getItem('gachamon-save-v1');return s && JSON.parse(s).trainer?.sprite})()` });
  assert.equal(save.result.result.value, 'leaf', 'new game saves selected trainer');
  await send('Runtime.evaluate', { expression: `(() => {const s=JSON.parse(localStorage.getItem('gachamon-save-v1')); for(let i=1;i<=2000;i++) s.dex[i]=s.dex[i]||1; localStorage.setItem('gachamon-save-v1',JSON.stringify(s));})()` });
  await send('Page.reload');
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const restored = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.parse(localStorage.getItem('gachamon-save-v1')).trainer.sprite` });
  assert.equal(restored.result.result.value, 'leaf', 'trainer selection survives reload');
  await send('Runtime.evaluate', {awaitPromise:true, expression:`navigator.serviceWorker.ready.then(() => true)`});
  await send('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:0, uploadThroughput:0});
  try {
    await send('Page.reload');
    await new Promise(resolve => setTimeout(resolve, 6000));
    const offline = await send('Runtime.evaluate', {returnByValue:true, expression:`(() => ({title:!!document.querySelector('.ti-go'), trainer:JSON.parse(localStorage.getItem('gachamon-save-v1') || '{}').trainer?.sprite}))()`});
    assert.equal(offline.result.result.value.title, true, 'game starts from cache offline');
    assert.equal(offline.result.result.value.trainer, 'leaf', 'save survives offline reload');
  } finally {
    await send('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1});
  }
  for (const selector of ['.ti-go','.lab-skip','.lab-av[data-k="leaf"]','.lab-ok']) {
    await send('Runtime.evaluate', {expression:`(() => {const el=document.querySelector(${JSON.stringify(selector)}); if(!el) throw Error('missing '+${JSON.stringify(selector)}); el.click()})()`});
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  await send('Runtime.evaluate', {expression:`(() => {const form=document.querySelector('.lab-name'); if(!form) throw Error('name form missing'); form.requestSubmit()})()`});
  await new Promise(resolve=>setTimeout(resolve,2000));
  for(let i=0;i<10;i++) { await send('Runtime.evaluate',{expression:`document.querySelector('.chen-text')?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`}); await new Promise(resolve=>setTimeout(resolve,500)); }
  const replayAbsent = await send('Runtime.evaluate', {returnByValue:true, expression:`!document.querySelector('[data-screen="cinematics"], #screen-cinematics')`});
  assert.equal(replayAbsent.result.result.value, true, 'replay gallery is absent');
  await send('Runtime.evaluate', { expression: `document.querySelector('#options-btn').click()` });
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(resourceFailures, [], 'critical resources load successfully');
  // Exercise the actual CDP error path for both Image and fetch resource types.
  const missingAssets = ['/assets/pokemon/art/smoke-missing.gif', '/assets/trainers/smoke-missing.png'];
  await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => { await Promise.all([fetch(${JSON.stringify(missingAssets[0])}), new Promise(resolve => { const image = new Image(); image.onload = image.onerror = resolve; image.src = ${JSON.stringify(missingAssets[1])}; })]); })()` });
  await new Promise(resolve => setTimeout(resolve, 200));
  for (const asset of missingAssets) assert.ok(resourceFailures.some(failure => failure.includes(asset)), `missing asset detected: ${asset}`);
  resourceFailures.length = 0;
  // The intentionally invalid scene URL may fail to load; it must never become markup.
  checkResources = false;
  const payload = '\"><img src=x onerror="parent.smokeXss=1">';
  await send('Runtime.evaluate', {expression:`(() => { window.smokeXss=0; const f=document.createElement('iframe'); f.id='smoke-xss'; f.src='/intros/legend-intros.html#'+new URLSearchParams({player:'1',mon:'latias',hold:'1',scene:${JSON.stringify(payload)}}); document.body.appendChild(f); })()`});
  await new Promise(resolve => setTimeout(resolve, 3000));
  const xss = await send('Runtime.evaluate', {returnByValue:true, expression:`(() => {const doc=document.querySelector('#smoke-xss').contentDocument, select=doc.querySelector('#scene'); return {executed:window.smokeXss, value:select.value, injected:!!select.querySelector('img'), option:select.options[0].value};})()`});
  assert.deepEqual(xss.result.result.value, {executed:0, value:payload, injected:false, option:payload}, 'scene remains an option value, not HTML');
  assert.deepEqual(exceptions, [], 'no uncaught runtime exceptions');
  console.log('Browser smoke test passed:', state, 'battle log updated');
  } finally {
    try { if (browserContextId) await send('Target.disposeBrowserContext', { browserContextId }, null); }
    finally { socket.close(); }
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
