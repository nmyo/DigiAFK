const fs = require('node:fs');
const path = require('node:path');

function replaceOnce(source, pattern, replacement, name) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`Expected exactly one ${name}`);
  return source.replace(pattern, replacement);
}
function patchBoot(boot) {
  boot = replaceOnce(boot, /window\.LANG_FILES=\{[^}]+\}/g, m => {
    const hans = m.match(/"zh-Hans":\[[^\]]+\]/)[0];
    const hant = m.match(/"zh-Hant":\[[^\]]+\]/)[0];
    return `window.LANG_FILES={${hans},${hant}}`;
  }, 'language files');
  boot = replaceOnce(boot, /function\(\)\{const A="pokecatch\.lang".*?\}\(\);var o=/g, `function(){const A="pokecatch.lang",a=["zh-Hans","zh-Hant"];let n="auto";try{n=localStorage.getItem(A)||"auto"}catch{}const h=()=>{const l=(navigator.languages&&navigator.languages[0])||navigator.language||"";return /^zh(?:-|$)/i.test(l)&&/hant|-(tw|hk|mo)\\b/i.test(l)?"zh-Hant":"zh-Hans"},g=a.includes(n)?n:n==="auto"?h():"zh-Hans";window.LANG_PICK={pref:a.includes(n)?n:"auto",lang:g,LANGS:a};window.LANG_LOAD(window.LANG_FILES[g])}();var o=`, 'language picker');
  return boot.replace('lang:"fr",class:"px"', 'lang:"zh-Hans",class:"px"');
}
function patchApp(file) {
  let app = fs.readFileSync(file, 'utf8');
  const old = 'g={fr:"Français",en:"English",es:"Español",de:"Deutsch","zh-Hans":"简体中文","zh-Hant":"繁體中文",ko:"한국어",ja:"日本語"}';
  const replacement = 'g={"zh-Hans":"简体中文","zh-Hant":"繁體中文"}';
  if (app.includes(old)) app = app.replace(old, replacement);
  else if (!app.includes(replacement)) throw new Error('Language names not found');
  const oldFlavor = 'Ot.flavor=ce[2]||Ot.flavor';
  const previousFlavor = 'Ot.flavor=ce[2]||(ue==="zh-Hant"?"暫無圖鑑介紹。":"暂无图鉴介绍。")';
  const chineseFlavor = 'Ot.flavor=ce[2]||(ue==="zh-Hant"?"無介紹":"无介绍")';
  if (app.includes(oldFlavor)) app = app.replace(oldFlavor, chineseFlavor);
  else if (app.includes(previousFlavor)) app = app.replace(previousFlavor, chineseFlavor);
  else if (!app.includes(chineseFlavor)) throw new Error('Pokédex flavor localization not found');
  fs.writeFileSync(file, app);
}
module.exports = {patchBoot, patchApp};
