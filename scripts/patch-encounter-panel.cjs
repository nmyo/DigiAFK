// Simplify the ordinary wild encounter panel without changing encounter rules.
const fs = require('node:fs');
const path = require('node:path');
const start = 'const ut=[...O,...Se],k=ut.filter(l=>ns(l.id)).length,';
const end = 'async function Dn(o)';
const replacement = `const ut=[...O,...Se],k=ut.filter(l=>ns(l.id)).length,r=(qt?.name||"")+"|"+ut.map(l=>l.id+(ns(l.id)?"c":"u")).join(",");if(r===vn)return;vn=r;o.innerHTML=\`<div class="zone-box">
      <div class="zone-head"><b>\${e("À trouver ici")}</b><span class="muted">\${U(e(qt?.name||d.CHAPTERS[z.chapter].name))}</span><span class="zone-count \${k===ut.length?"done":""}">\${k}/\${ut.length}</span></div>
      <div class="zone-scroll"><div class="zone-grid">\${ut.map(i=>{const p=ns(i.id),y=ce.DEX[i.id].name;return\`<div class="zone-cell \${p?"caught":"seen zone-uncaught"}" data-id="\${i.id}" title="\${U(y)}\${p?"":t.I18n.lang==="zh-Hant"?" · 未收錄":" · 未收录"}">\${se(i.id,!1,t.UI.tileScale(i.id),48)}\${p?"":'<span class="zone-pct zone-uncaught-label">NEW</span>'}</div>\`}).join("")}</div></div></div>\`,at(o,"zone"),o.onclick=l=>{const i=l.target.closest(".zone-cell[data-id]");i&&t.Screens.pokedex.openCard(+i.dataset.id,ut.map(p=>p.id))}}`;
// Use a dedicated marker rather than displaying encounter percentages.
const output = replacement.replace('zone-pct zone-uncaught-label', 'zone-uncaught-label');
function patchEncounterPanel(source) {
  const oldOutput = output.replace('t.I18n.lang==="zh-Hant"?" · 未收錄":" · 未收录"', '" · 未收录 / 未收錄"');
  if (source.includes(oldOutput) && oldOutput !== output) return source.replace(oldOutput, output);
  if (source.includes(output)) return source;
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0 || source.indexOf(start, a + 1) !== -1 || !source.slice(a, b).includes('zone-weather')) throw new Error('Unexpected encounter panel seam');
  return source.slice(0, a) + output + source.slice(b);
}
function patchBundle() {
  const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, patchEncounterPanel(source));
}
if (require.main === module) patchBundle();
module.exports = { patchEncounterPanel, patchBundle };
