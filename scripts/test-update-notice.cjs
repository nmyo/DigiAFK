const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/update-notice.js', 'utf8');
const start = source.indexOf('    /* 热更新：');
assert.ok(start >= 0);
async function scenario(title, lang = 'zh-Hans') {
  let version = 'one', reloads = 0, button, interval, message;
  const document = {
    readyState: 'complete', hidden: false, documentElement: {lang},
    body: { appendChild(node) { button = node; } },
    getElementById() { return button; },
    createElement() { return { style: {} }; },
    querySelector(selector) { return selector === 'meta[name="pc-build"]' ? null : { checkVisibility: () => title }; },
    addEventListener() {}
  };
  const window = {};
  const context = { document, window, location: { reload() { reloads++; } }, navigator: { serviceWorker: { addEventListener(type, fn) { message = fn; } } }, fetch: async () => ({ ok: true, json: async () => ({ v: version }) }), setInterval(fn) { interval = fn; }, Date };
  vm.runInNewContext(source.slice(start), context);
  await new Promise(setImmediate);
  assert.equal(window.__pcHot.state(), 'one');
  version = 'two'; interval(); await new Promise(setImmediate);
  if (title) { assert.equal(reloads, 1); assert.equal(button, undefined); message({data:{type:'pc-updated'}}); assert.equal(reloads, 2); }
  else { assert.equal(reloads, 0); assert.equal(button.id, 'pc-update'); assert.equal(button.textContent, lang === 'zh-Hant' ? '發現新版本 · 點擊更新' : '发现新版本 · 点击更新'); button.onclick(); assert.equal(reloads, 1); }
}
async function failedFirstRequest() {
  let calls = 0, interval, button;
  const document = {
    readyState: 'complete', hidden: false, documentElement: {lang:'zh-Hans'},
    body: { appendChild(node) { button = node; } },
    getElementById() { return button; }, createElement() { return { style: {} }; },
    querySelector(selector) { return selector === 'meta[name="pc-build"]' ? { content: 'old' } : null; },
    addEventListener() {}
  };
  const window = {};
  vm.runInNewContext(source.slice(start), { document, window, navigator: {}, location: { reload() {} },
    fetch: async () => { if (++calls === 1) throw Error('offline'); return { ok: true, json: async () => ({ v: 'new' }) }; },
    setInterval(fn) { interval = fn; }, Date });
  await new Promise(setImmediate);
  assert.equal(window.__pcHot.state(), 'old');
  interval(); await new Promise(setImmediate);
  assert.equal(button.id, 'pc-update');
}
(async () => { await scenario(true); await scenario(false); await scenario(false, 'zh-Hant'); await failedFirstRequest(); console.log('Update notice title, game and failed initial request checks passed.'); })().catch(e => { console.error(e); process.exitCode = 1; });
