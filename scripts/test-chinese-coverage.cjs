// Check literal translation calls. Dynamic strings and rendered states require separate review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const site = path.join(__dirname, '..', 'site');
const app = fs.readFileSync(path.join(site, 'bundle/app.c74e480997.js'), 'utf8');
const literals = new Set();
for (const match of app.matchAll(/\be\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
  const key = vm.runInNewContext(match[1]);
  if (/[A-Za-zÀ-ÿ]{2}/.test(key)) literals.add(key);
}
for (const [lang, file] of [['zh-Hans', 'lang-zh-Hans.2a57ab3291.js'], ['zh-Hant', 'lang-zh-Hant.ff6e3ad523.js']]) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(site, 'bundle', file), 'utf8'), { window });
  const missing = [...literals].filter(key => !Object.hasOwn(window.I18N[lang], key));
  assert.deepEqual(missing, [], `${lang} missing literal translation keys`);
  for (const key of ['{name} Nv. {n}', 'Nv. {from} → <b>{to}</b>']) {
    assert.match(window.I18N[lang][key], /等级|等級/, `${lang} level label should be Chinese`);
  }
  console.log(`${lang}: ${literals.size} literal translation calls covered.`);
}
