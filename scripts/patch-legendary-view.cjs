// Remove only the legendary team leaderboard view; the zone's popular teams remain shared.
const fs = require('node:fs');
const path = require('node:path');
const changes = [
  [
    "let Ut=\"zone\",ba=0;const Me={},gt={};",
    "const Me={},gt={};"
  ],
  [
    "const Gt=xe=>{const Nt=Math.max(0,Math.floor((Date.now()-Date.parse(xe))/6e4));return Nt<1?e(\"à l'instant\"):Nt<60?e(\"il y a {n} min\",{n:Nt}):Nt<1440?e(\"il y a {n} h\",{n:Math.floor(Nt/60)}):e(\"il y a {n} j\",{n:Math.floor(Nt/1440)})},ot=xe=>({rank:!1,me:xe.me,player:xe.team||{},mons:xe.team?.mons,lv:!0,score:{sub:Gt(xe.at)}}),Mt=xe=>t.UI.holdNote(e(\"Tu n'apparais pas dans les classements.\"))+da(xe);function da(xe){if(!t.Cloud?.user)return`<p class=\"ev-lb-none\">${e(\"Connecte-toi (Options) pour voir les équipes des autres dresseurs.\")}</p>`;Ct(xe.id);const Nt=Dt().board(xe.id),ea=f(I.DEX[xe.id].name);return Nt?Nt.teams.length?`<p class=\"lzb-hint\">${e(\"Les équipes des dresseurs qui ont capturé {name}, pour t'en inspirer.\",{name:ea})}</p>${Pa(Nt)}\r\n      <div class=\"dc-sec lzb-list\"><h4>${e(\"Dernières victoires\")}</h4>${t.UI.lbList(D=Nt.teams.map(ot))}</div>`:`<p class=\"ev-lb-none\">${e(\"Personne n'a encore capturé {name} : à toi d'ouvrir la voie !\",{name:ea})}</p>`:`<p class=\"ev-lb-none\">${Me[xe.id]?e(\"Équipes indisponibles pour le moment.\"):e(\"Chargement…\")}</p>`}const Pa=xe=>",
    "const Pa=xe=>"
  ],
  [
    "Ja=t.TYPES[Ga.types[0]].color,Va=Ut===\"teams\",rn=Dt().eliteOpen(xe)",
    "Ja=t.TYPES[Ga.types[0]].color,rn=Dt().eliteOpen(xe)"
  ],
  [
    "${xe.roam?\"\":`<div class=\"seg ev-seg\">\r\n          <button class=\"${Va?\"\":\"on\"}\" data-lz-view=\"zone\">${e(\"Élite\")}</button><button class=\"${Va?\"on\":\"\"}\" data-lz-view=\"teams\">${e(\"Équipes\")}</button></div>`}</div>\r\n        <div class=\"ev-board\" ${Va?\"\":\"hidden\"}>${Va?Mt(xe):\"\"}</div>\r\n        <div class=\"ev-hunt\" ${Va?\"hidden\":\"\"}>\r\n        <div class=\"mp-chips\"><span>${e(\"Niv. {lv}\",{lv:`<b>${t.CONFIG.MAX_LEVEL}</b>`})}</span><span class=\"lz-rank\">${e(\"Rang {r}\",{r:ka[Oa]})}</span>${Ga.types.map(Kt=>`<span c",
    "</div>\r\n        <div class=\"ev-hunt\">\r\n        <div class=\"mp-chips\"><span>${e(\"Niv. {lv}\",{lv:`<b>${t.CONFIG.MAX_LEVEL}</b>`})}</span><span class=\"lz-rank\">${e(\"Rang {r}\",{r:ka[Oa]})}</span>${Ga.types.map(Kt=>`<span c"
  ],
  [
    "current:!1},rn=Ut===\"teams\";return`<div class=\"mp-det\"",
    "current:!1};return`<div class=\"mp-det\""
  ],
  [
    "Une Poké Ball part à chaque K.O., avec peu de chances : essais illimités, une seule capture. « Équipes » montre celles qui l'ont eu.",
    "Une Poké Ball part à chaque K.O., avec peu de chances : essais illimités, une seule capture."
  ],
  [
    "<div class=\"seg ev-seg\">\r\n          <button class=\"${rn?\"\":\"on\"}\" data-lz-view=\"zone\">${e(\"Zone\")}</button><button class=\"${rn?\"on\":\"\"}\" data-lz-view=\"teams\">${e(\"Équipes\")}</button></div></div>\r\n        <div class=\"ev-board\" ${rn?\"\":\"hidden\"}>${rn?Mt(xe):\"\"}</div>\r\n        <div class=\"ev-hunt\" ${rn?\"hidden\":\"\"}>\r\n        <div class=\"mp-chips\"><span>${e(\"Niv. {lv}\",{lv:`<b>${xe.level}</b>`})}</span><span>📍 ${f(e(xe.zone))}</span>${Ga.types.map(je=>`<span class=\"ty\" data",
    "</div>\r\n        <div class=\"ev-hunt\">\r\n        <div class=\"mp-chips\"><span>${e(\"Niv. {lv}\",{lv:`<b>${xe.level}</b>`})}</span><span>📍 ${f(e(xe.zone))}</span>${Ga.types.map(je=>`<span class=\"ty\" data"
  ],
  [
    "ht!==String(M)&&(Ut=\"zone\"),M=ht===",
    "M=ht==="
  ],
  [
    "g(\"[data-lz-view]\",Va).forEach(te=>te.onclick=()=>{te.dataset.lzView!==Ut&&(Ut===\"zone\"&&(ba=te.closest(\".mp-det\").offsetHeight),Ut=te.dataset.lzView,es())});const aa=String(M)[0]===\"Z\"&&a(\".mp-det\",Va);aa&&Ut===\"teams\"&&ba&&Object.assign(aa.style,{flex:`0 0 ${ba}px`,minHeight:\"0\"}),t.UI.lbBind(Va,D)",
    "t.UI.lbBind(Va,D)"
  ]
].map(([before, after]) => [before.replace(/\r\n/g, '\n'), after.replace(/\r\n/g, '\n')]);
function patchLegendaryView(source) {
  for (const [oldText, newText] of changes) {
    const oldCount = source.split(oldText).length - 1, newCount = source.split(newText).length - 1;
    if (newCount === 1 && oldCount === (newText.includes(oldText) ? 1 : 0)) continue;
    if (oldCount !== 1 || newCount !== (oldText.includes(newText) ? 1 : 0)) throw new Error('Unexpected legendary view seam: ' + oldText.slice(0, 80));
    source = source.replace(oldText, newText);
  }
  return source;
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8'), patched = patchLegendaryView(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log('Legendary view verified.');
}
if (require.main === module) patchBundle();
module.exports = { patchBundle, patchLegendaryView, changes };
