// Add an explicit PC-to-team interaction while sharing the drag/drop commit path.
const fs = require('node:fs');
const path = require('node:path');
const changes = [
  ['function A(ct){const re=H.S.team,_e=[...Ie];', `let teamChoice=null,teamChoiceOrigin=null;function teamChoiceCancel(){const origin=teamChoiceOrigin;teamChoice=null;teamChoiceOrigin=null;teamChoiceRender();if(origin&&origin.isConnected&&!origin.disabled)origin.focus()}function teamChoiceRender(){const bar=a("#team-choice");if(!bar)return;bar.replaceChildren();if(!teamChoice){bar.hidden=!0;return}bar.hidden=!1;const label=document.createElement("span");label.textContent="选择要替换的队员，或选择空位加入：";bar.appendChild(label);for(let i=0;i<Ot.TEAM_SIZE;i++){const uid=H.S.team[i],mon=uid&&H.getMon(uid),button=document.createElement("button");button.type="button";button.className="btn small";button.textContent=mon?"替换 "+H.DEX[mon.id].name:"加入空位";button.disabled=!mon&&i!==H.S.team.length;button.onclick=()=>{const selected=teamChoice,source=H.getMon(selected),slot=uid?H.S.team.indexOf(uid):H.S.team.length;if(!source||!H.S.mons.includes(source)||H.S.team.includes(selected)||!Ie.includes(selected)||uid&&slot<0||!uid&&H.S.team.length>=Ot.TEAM_SIZE){teamChoice=null;teamChoiceRender();I("队伍或仓库已变化，请重新选择。");return}teamChoice=null;teamChoiceRender();A({src:"pc",zone:"team",uid:selected,slot})};bar.appendChild(button)}const cancel=document.createElement("button");cancel.type="button";cancel.className="btn small ghost";cancel.textContent="取消";cancel.onclick=teamChoiceCancel;bar.appendChild(cancel)}function A(ct){const re=H.S.team,_e=[...Ie];`],
  ['<span class="lvl">${Gt.shiny?t.UI.shinyIc():""}${e("Nv. {n}",{n:Gt.level})}${H.S.buddy.uid===Gt.uid?se():""}</span>', '<button type="button" class="btn small team-choose" data-choose-uid="${Gt.uid}" ${ot?`disabled title="${U(ot)}"`:""} aria-label="加入或更换队员：${U(H.DEX[Gt.id].name)}">更换</button><span class="lvl">${Gt.shiny?t.UI.shinyIc():""}${e("Nv. {n}",{n:Gt.level})}${H.S.buddy.uid===Gt.uid?se():""}</span>'],
  ['const ct=a("#pc-grid");kt=t.VGrid(ct)', 'const ct=a("#pc-grid"),choiceBar=document.createElement("div");choiceBar.id="team-choice",choiceBar.hidden=!0,choiceBar.setAttribute("role","group"),choiceBar.setAttribute("aria-label","选择队伍位置"),ct.before(choiceBar),document.addEventListener("keydown",re=>{if(re.key==="Escape"&&teamChoice)teamChoiceCancel()}),kt=t.VGrid(ct)'],
  ['ct.addEventListener("click",re=>{const _e=re.target.closest(".pc-cell");', 'ct.addEventListener("click",re=>{const button=re.target.closest(".team-choose");if(button){re.stopPropagation();if(document.body.classList.contains("swap-mode"))return;const mon=H.getMon(button.dataset.chooseUid),why=mon&&H.can(mon);if(!mon||!H.S.mons.includes(mon)||H.S.team.includes(mon.uid)||!Ie.includes(mon.uid))return;if(why){I(`${t.UI.lockIc}${U(why)}`);return}teamChoice=mon.uid;teamChoiceOrigin=button;teamChoiceRender();a("#team-choice button")?.focus();return}const _e=re.target.closest(".pc-cell");'],
  ['ct.addEventListener("pointerdown",re=>{const _e=re.target.closest(".pc-cell:not(.ug-out)");', 'ct.addEventListener("pointerdown",re=>{if(re.target.closest(".team-choose"))return;const _e=re.target.closest(".pc-cell:not(.ug-out)");'],
  ['leave(){Ae(!1),H.S.pcVisit=Date.now()', 'leave(){teamChoice=null,teamChoiceOrigin=null,teamChoiceRender(),Ae(!1),H.S.pcVisit=Date.now()'],
  ['render(){Re||(lt(),Yt())},sorted:mt', 'render(){Re||(lt(),Yt(),teamChoiceRender())},sorted:mt']
];
function patchTeamInteraction(source) {
  for (const [oldText, newText] of changes) {
    const oldCount = source.split(oldText).length - 1, newCount = source.split(newText).length - 1;
    if (newCount === 1 && oldCount === (newText.includes(oldText) ? 1 : 0)) continue;
    if (oldCount !== 1 || newCount) throw new Error('Unexpected team interaction seam: ' + oldText.slice(0, 80));
    source = source.replace(oldText, newText);
  }
  return source;
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8'), patched = patchTeamInteraction(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log('Team interaction verified.');
}
if (require.main === module) patchBundle();
module.exports = { patchBundle, patchTeamInteraction };
