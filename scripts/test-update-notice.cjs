const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/update-notice.js', 'utf8');
const start = source.indexOf('    /* 热更新：');
assert.ok(start >= 0);
async function scenario(title) {
  let version = 'one', reloads = 0, button, interval, message;
  const document = {
    readyState: 'complete', hidden: false,
    body: { appendChild(node) { button = node; } },
    getElementById() { return button; },
    createElement() { return { style: {} }; },
    querySelector() { return { checkVisibility: () => title }; },
    addEventListener() {}
  };
  const window = {};
  const context = { document, window, location: { reload() { reloads++; } }, navigator: { serviceWorker: { addEventListener(type, fn) { message = fn; } } }, fetch: async () => ({ ok: true, json: async () => ({ v: version }) }), setInterval(fn) { interval = fn; }, Date };
  vm.runInNewContext(source.slice(start), context);
  await new Promise(setImmediate);
  assert.equal(window.__pcHot.state(), 'one');
  version = 'two'; interval(); await new Promise(setImmediate);
  if (title) { assert.equal(reloads, 1); assert.equal(button, undefined); message({data:{type:'pc-updated'}}); assert.equal(reloads, 2); }
  else { assert.equal(reloads, 0); assert.equal(button.id, 'pc-update'); button.onclick(); assert.equal(reloads, 1); }
}
(async () => { await scenario(true); await scenario(false); console.log('Update notice title and game checks passed.'); })().catch(e => { console.error(e); process.exitCode = 1; });
