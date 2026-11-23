const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('site/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function message(pref, language) {
  const body = {children: [], appendChild(child) { this.children.push(child); }};
  const document = {
    body,
    head: {appendChild() {}},
    getElementById: () => null,
    createElement: () => ({children: [], appendChild(child) { this.children.push(child); }}),
  };
  const window = {};
  vm.runInNewContext(script, {window, document, navigator: {language}, localStorage: {getItem: () => pref}, location: {origin: 'http://localhost'}});
  window.BOOT_FAIL();
  return body.children[0].children.map(child => child.textContent);
}
const traditional = ['遊戲載入失敗。請檢查網路連線後重試。', '重試'];
const simplified = ['游戏加载失败。请检查网络连接后重试。', '重试'];
for (const region of ['TW', 'HK', 'MO']) {
  assert.deepEqual(message(null, 'zh-' + region), traditional);
  assert.deepEqual(message('auto', 'zh-' + region), traditional);
  assert.deepEqual(message('en', 'zh-' + region), simplified);
}
assert.deepEqual(message('zh-Hant', 'en-US'), traditional);
assert.deepEqual(message('zh-Hans', 'zh-TW'), simplified);
assert.deepEqual(message(null, 'zh-CN'), simplified);
console.log('BOOT_FAIL regional language and saved preferences verified.');
