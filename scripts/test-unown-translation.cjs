const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchUnownTranslation } = require('./patch-unown-translation.cjs');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
assert.equal(patchUnownTranslation(source), source);
const start = source.indexOf('t.UNOWN=function()');
const end = source.indexOf(',t.SPECIALS=function()', start);
assert.ok(start >= 0 && end > start);
for (const [lang, file] of [['zh-Hans', 'lang-zh-Hans.2a57ab3291.js'], ['zh-Hant', 'lang-zh-Hant.ff6e3ad523.js']]) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('site/bundle/' + file, 'utf8'), context);
  const t = { POKEDEX: [{ id: 201, name: 'Zarbi', genus: 'English genus', flavor: 'English description' }], BASE_EXP: { 201: 1 }, I18N_DATA: context.window.I18N_DATA, I18n: { lang } };
  vm.runInNewContext(source.slice(start, end), { t });
  const translated = t.I18N_DATA[lang].pokemon[201];
  const localization = source.match(/for\(const Ot of t\.POKEDEX\|\|\[\]\)\{const ce=et\.pokemon\?\.\[Ot\.id\];ce&&\(Ot\.name=ce\[0\]\|\|Ot\.name,Ot\.genus=ce\[1\]\|\|Ot\.genus,Ot\.flavor=.*?\)\}/);
  assert.ok(localization, 'actual Pokédex localization pass');
  t.POKEDEX.push({ id: 1, name: 'old', genus: 'old', flavor: 'old' });
  vm.runInNewContext(localization[0], { t, et: t.I18N_DATA[lang], ue: lang });
  assert.equal(t.POKEDEX.length, 29);
  for (const mon of t.POKEDEX.slice(0, 28)) {
    assert.equal(mon.genus, translated[1]);
    assert.equal(mon.flavor, lang === 'zh-Hant' ? '暫無圖鑑介紹。' : '暂无图鉴介绍。');
  }
  assert.equal(t.POKEDEX[28].flavor, t.I18N_DATA[lang].pokemon[1][2]);
  for (const [id, entry] of Object.entries(t.I18N_DATA[lang].pokemon)) {
    const mon = { id: +id, name: 'old', genus: 'old', flavor: 'English description' };
    vm.runInNewContext(localization[0], { t: { POKEDEX: [mon] }, et: t.I18N_DATA[lang], ue: lang });
    assert.equal(mon.flavor, entry[2] || (lang === 'zh-Hant' ? '暫無圖鑑介紹。' : '暂无图鉴介绍。'));
  }
}
assert.throws(() => patchUnownTranslation('unexpected bundle'), /seam/);
console.log('Unown forms share localized Pokédex introductions in both Chinese languages.');
