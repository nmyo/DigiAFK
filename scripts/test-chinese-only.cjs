const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {patchBoot, patchApp} = require('./chinese-only.cjs');
const boot = fs.readFileSync('site/boot.js', 'utf8');
const files = boot.match(/window\.LANG_FILES=\{[^}]+\}/)[0];
const picker = boot.match(/function\(\)\{const A="pokecatch\.lang".*?\}\(\);var o=/)[0].replace(/var o=$/, '');
for (const [pref, browser, expected] of [[null,'en-US','zh-Hans'],[null,'zh-TW','zh-Hant'],['fr','zh-TW','zh-Hans'],['en','en-US','zh-Hans'],['zh-Hant','en-US','zh-Hant'],['zh-Hans','zh-TW','zh-Hans']]) {
  const window = {LANG_LOAD: paths => { window.loaded = paths; }};
  const context = {window, navigator: {language: browser, languages: [browser]}, localStorage: {getItem: () => pref}, URL, location: 'http://localhost/sub/'};
  vm.runInNewContext(files + ';(' + picker.replace(/;$/, '') + ')' , context);
  assert.equal(window.LANG_PICK.lang, expected);
  assert.deepEqual(Array.from(window.LANG_PICK.LANGS), ['zh-Hans', 'zh-Hant']);
  assert.equal(window.loaded.length, 1);
  const filename = new URL(window.loaded[0]).pathname.split('/').pop();
  vm.runInNewContext(fs.readFileSync('site/bundle/' + filename, 'utf8'), context);
  assert.ok(window.I18N_DATA[expected].pokemon[1]);
}
// Rebuilding from the same upstream boot must produce identical output.
assert.equal(patchBoot(boot), boot);
const app = 'site/bundle/app.c74e480997.js';
const before = fs.readFileSync(app, 'utf8');
patchApp(app); patchApp(app);
assert.equal(fs.readFileSync(app, 'utf8'), before);
console.log('Chinese language loading, legacy preferences, and patch idempotence verified.');
