// Remove only permanently hidden controls whose callers can be safely detached.
const fs = require('node:fs');
const path = require('node:path');
const site = path.join(__dirname, '..', 'site');
function replace(source, old, replacement, name) {
  const count = source.split(old).length - 1;
  const done = source.split(replacement).length - 1;
  if (count === 1) return source.replace(old, replacement);
  if (count === 0 && done === 1) return source;
  throw new Error(`Unexpected ${name}: old=${count}, patched=${done}`);
}
function patch() {
  const bootPath = path.join(site, 'boot.js');
  const appPath = path.join(site, 'bundle/app.c74e480997.js');
  let boot = fs.readFileSync(bootPath, 'utf8');
  let app = fs.readFileSync(appPath, 'utf8');
  const save = boot.match(/<button class="tb-save" id="save-btn".*?<\/button>/g) || [];
  if (save.length === 1) boot = boot.replace(save[0], '');
  else if (save.length !== 0 || boot.includes('id="save-btn"')) throw new Error('Unexpected save button');
  app = replace(app, 'a("#save-btn").onclick=S,t.Cloud?.on(ce)', 't.Cloud?.on(ce)', 'save button handler');
  const guide = boot.match(/        <button class="side-bug side-guide" id="guide-btn"[^\n]*<\/button>\n/g) || [];
  if (guide.length === 1) boot = boot.replace(guide[0], '');
  else if (guide.length !== 0 || boot.includes('id="guide-btn"')) throw new Error('Unexpected guide button');
  const row = '            <div class="ti-row"><button class="btn outline lg ti-how-btn">${e("Comment jouer")}</button><button class="btn outline lg ti-cl-btn${t.Changelog?.isNew()?" has-new":""}"><img class="pn-ic" src="assets/ui/orange-mail.png" alt=""> Changelogs<span class="new">NEW</span></button></div>\n';
  if (app.includes(row)) app = app.replace(row, '');
  else if (app.includes('class="ti-row"')) throw new Error('Unexpected title controls');
  app = replace(app, 'a(".ti-how-btn",yt).onclick=()=>{t.Sfx?.unlock?.(),ce()},a(".ti-cl-btn",yt).onclick=async()=>{t.Sfx?.unlock?.(),await t.Changelog.open(),a(".ti-cl-btn",yt).classList.remove("has-new"),t.Changelog.badge()},a(".ti-go",yt).onclick=', 'a(".ti-go",yt).onclick=', 'title control handlers');
  if (app.includes('t.Guide=function(){')) app = replace(app, 'return document.addEventListener("click",ce=>{ce.target.closest?.("#guide-btn")&&Ot()}),{open:Ot,isNew:se}}(),t.News=', 'return{open:Ot,isNew:se}}(),t.News=', 'guide button delegation');
  const community = /ft&&\{id:"community",name:e\("Communauté"\),ic:Z\("assets\/ui\/link-cable\.svg"\),c:"var\(--blue-vivid\)",html:\(\)=>de\(`[^`]*`\)\}/g;
  const communities = app.match(community) || [];
  if (communities.length === 1) app = app.replace(community, '');
  else if (communities.length !== 0 || app.includes('id:"community"')) throw new Error('Unexpected community option');
  if (app.includes('},].filter(Boolean)],[e("Aide")')) app = app.replace('},].filter(Boolean)],[e("Aide")', '}].filter(Boolean)],[e("Aide")');
  const news = /\{id:"news",name:e\("Nouveautés"\),ic:Z\("assets\/ui\/orange-mail\.png"\),c:"var\(--yellow\)",isNew:\(\)=>t\.Changelog\.isNew\(\)\|\|t\.Guide\.isNew\(\),html:\(\)=>de\(`[^`]*`\)\},/g;
  const newsEntries = app.match(news) || [];
  if (newsEntries.length === 1) app = app.replace(news, '');
  else if (newsEntries.length !== 0 || app.includes('id:"news",name:e("Nouveautés")')) throw new Error('Unexpected news option');
  app = replace(app, 'B(qe,"changelog",()=>{nt(null),t.Changelog.open()}),B(qe,"guide",()=>{nt(null),t.Guide.open()}),B(qe,"reset",', 'B(qe,"reset",', 'news option handlers');
  app = replace(app, 'a("#options-btn").onclick=()=>t.Options.open(),t.Changelog.badge(),document.addEventListener', 'a("#options-btn").onclick=()=>t.Options.open(),document.addEventListener', 'changelog badge initialization');
  const footer = '+(t.App.communityLine()?`<p class="op-community">${t.App.communityLine()}</p>`:"")';
  if (app.split(footer).length === 2) app = app.replace(footer, '');
  else if (app.includes('class="op-community"')) throw new Error('Unexpected community footer');
  // Remove the offline-only navigation and the achievement screen together with their callers.
  function removeBlock(source, start, end, name) {
    const first = source.indexOf(start);
    if (first < 0) return source;
    const last = source.indexOf(end, first);
    if (last < 0 || source.indexOf(start, first + start.length) >= 0) throw new Error(`Unexpected ${name}`);
    return source.slice(0, first) + source.slice(last + end.length);
  }
  boot = removeBlock(boot, '        <div class="nav-grp" data-grp="social">\n', '          </div></div>\n        </div>\n', 'social navigation');
  boot = boot.replace(/^        <button data-screen="achievements"[^\n]*\n/m, '');
  boot = removeBlock(boot, '      <section class="screen" id="screen-achievements">\n', '      </section>\n', 'achievement screen');
  app = removeBlock(app, 'const Gt=a(\'#tabs [data-screen="trade"]\')', 'ca?.remove();', 'social badges');
  app = replace(app, 'ct=$t=>$t?`<button class="btn ghost tc-ach" data-ach>${D==="look"?e("Voir les apparences ({n} à débloquer) ›",{n:$t}):e("Voir les cadres ({n} à débloquer) ›",{n:$t})}</button>`:""', 'ct=$t=>""', 'trainer achievement link');
  app = removeBlock(app, 'if($t.target.closest("[data-ach]")){', 't.App.show("achievements");return}', 'trainer achievement handler');
  const achStart = 'function(){const{$:a,esc:g,fmt:f,trainerFace:ue,artSrc:U,monSrc:Pt,hasArt:I}=t.UI,se=t.Game,Ve=()=>t.TrainerCard';
  const achEnd = '}(),function(){const{$:a,h:g,typeBadge:f,sprBox:ue,esc:U,idle:Pt,toast:I,buddyIcon:se,fmt:Ve,tween:tt,sleep:et,modal:v,confirm:M}=t.UI';
  if (app.includes(achStart)) {
    const start = app.indexOf(achStart), end = app.indexOf(achEnd, start);
    if (end < 0 || app.indexOf(achStart, start + 1) >= 0) throw new Error('Unexpected achievement module');
    app = app.slice(0, start) + app.slice(end + 4);
  }
  boot = boot.replace(/^            <button data-screen="raid"[^\n]*\n/m, '');
  const titleAccount = '            <div class="ti-account">${Je()}</div>\n';
  if (app.includes(titleAccount)) app = app.replace(titleAccount, '');
  const accountInit = 'const It=()=>{const he=a(".ti-account",yt);he.innerHTML=Je();const me=a(".ti-discord",he),Ce=a(".ti-google",he);me&&(me.onclick=()=>t.Cloud.signIn("discord")),Ce&&(Ce.onclick=()=>t.Cloud.signIn("google"))};It();const vt=t.Cloud?.on?.(It);';
  if (app.includes(accountInit)) app = app.replace(accountInit, '');
  app = app.replace('t.Sfx?.unlock?.(),vt?.();const he=!H()', 't.Sfx?.unlock?.();const he=!H()');
  const accountOption = `],[e("Compte"),[t.Cloud?.available&&{id:"account",name:e("Sauvegarde"),ic:Z("assets/ui/floppy.svg"),c:"var(--blue)",html:()=>'<div class="op-card op-account"></div>'}].filter(Boolean)`;
  if (app.includes(accountOption)) app = app.replace(accountOption, '');
  // Cinematics were previously embedded in achievements; keep their independent replay gallery.
  const replayNav = '        <button data-screen="cinematics"><span class="ic">▶</span><span class="l">剧情回放</span></button>\n';
  if (!boot.includes('data-screen="cinematics"')) boot = boot.replace('      </nav>', replayNav + '      </nav>');
  const replayScreen = '      <section class="screen" id="screen-cinematics"><div class="map-head"><h2>剧情回放</h2></div><div id="cinematics-root"></div></section>\n';
  if (!boot.includes('id="screen-cinematics"')) boot = boot.replace('      <section class="screen" id="screen-map">', replayScreen + '      <section class="screen" id="screen-map">');
  const replayModule = `function(){const {$:a,esc:g,artSrc:U,monSrc:Pt,hasArt:I}=t.UI;const types={mon:ie=>t.Game.DEX[ie]?.mythical?e("Pokémon fabuleux"):e("Pokémon légendaire"),champ:()=>e("Maître de la Ligue"),once:()=>e("Rencontre unique")};function card(ie){const locked=!ie.done,mon=t.Game.DEX[ie.id],src=ie.kind==="champ"?\`assets/trainers/\${g(ie.sprite)}.png\`:I(ie.id)?U(ie.id,ie.shiny,locked):Pt(ie.id,ie.shiny),name=ie.known?ie.kind==="champ"?e(ie.leader):e(mon.name):"???";return \`<button class="ach-cin\${locked?" lock":""}"\${locked?" disabled":\` data-cine="\${g(ie.key)}" title="\${t.I18n.lang==="zh-Hant"?"劇情回放":"剧情回放"}" style="background-image:url(assets/bg/scenes/\${ie.scene}-710x400.webp)"\`}>\${ie.fresh?'<span class="tc-new ach-new">NEW</span>':""}<img class="ach-cin-sp" src="\${src}" alt=""><span class="ach-cin-cap"><small>\${types[ie.kind](ie.id)}</small><b>\${g(name)}</b></span>\${locked?'<img class="ach-cin-pad" src="assets/ui/padlock.svg" alt="">':'<span class="ach-cin-play">▶</span>'}</button>\`}function render(){const list=t.Screens.adventure?.cinematics()||[],regions=[...new Set(list.map(x=>x.reg))],visible=regions.filter(r=>!list.find(x=>x.reg===r).away);a("#cinematics-root").innerHTML=visible.map(r=>{const items=list.filter(x=>x.reg===r);return \`<section class="ach-grp"><h4>\${g(e(t.STORY.REGIONS.find(x=>x.key===r).name))}<em>\${items.filter(x=>x.done).length} / \${items.length}</em></h4><div class="ach-gal">\${items.map(card).join("")}</div></section>\`}).join("")+(visible.length<regions.length?\`<div class="ach-lock">??? · \${t.I18n.lang==="zh-Hant"?"繼續冒險以發現更多劇情":"继续冒险以发现更多剧情"}</div>\`:"")}t.Screens.cinematics={init(){const label=t.I18n.lang==="zh-Hant"?"劇情回放":"剧情回放";a('[data-screen="cinematics"] .l').textContent=label;a("#screen-cinematics h2").textContent=label;a("#cinematics-root").addEventListener("click",ev=>{const button=ev.target.closest("[data-cine]");if(button){t.Sfx.click();t.Screens.adventure?.replayCinematic(button.dataset.cine).then(render)}})},render}}(),`;
  const replayAnchor = 'function(){const{$:a,h:g,typeBadge:f,sprBox:ue,esc:U,idle:Pt,toast:I,buddyIcon:se,fmt:Ve,tween:tt,sleep:et,modal:v,confirm:M}=t.UI';
  if (app.includes('t.Screens.cinematics=')) { const start=app.indexOf('function(){const {$:a,esc:g,artSrc:U,monSrc:Pt,hasArt:I}=t.UI;const types='); const end=app.indexOf(replayAnchor,start); if(start<0||end<0) throw new Error('Unexpected cinematics module'); app=app.slice(0,start)+app.slice(end); }
  app = replace(app, replayAnchor, replayModule + replayAnchor, 'cinematics module');
  // No mandatory callers depend on the hidden link; remaining SVG consumers use optional fallback.
  boot = boot.replace(/^        <a class="side-disc"[^\n]*\n/m, '');
  app = removeBlock(app, 't.Changelog=function(){', '}(),t.News=', 'guide and changelog modules');
  // Preserve the news module assignment at the removed boundary.
  if (!app.includes('t.News=function(){')) app = app.replace('function(){const{$:a,h:g,esc:f,sprBox:ue,itemSrc:U}=t.UI', 't.News=function(){const{$:a,h:g,esc:f,sprBox:ue,itemSrc:U}=t.UI');

  fs.writeFileSync(bootPath, boot);
  fs.writeFileSync(appPath, app);
}
module.exports = { patch };
