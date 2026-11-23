// Complete a region's Pokédex once its fourth Elite Four chapter is beaten.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../site/bundle/app.c74e480997.js');
let source = fs.readFileSync(file, 'utf8');
function replace(oldText, newText) {
  if (source.includes(newText)) return;
  if (source.split(oldText).length !== 2) throw Error('Unexpected region reward seam');
  source = source.replace(oldText, newText);
}
const helper = 'function regionDexReward(reg){const done=f.S.regionDexRewards||(f.S.regionDexRewards={});if(done[reg.key])return;for(const id of f.regionDexIds(reg)){if(f.S.dex[id]||f.DEX[id]?.legendary||f.DEX[id]?.mythical)continue;const mon=f.makeMon(id,46,{shiny:!1});mon.reg=reg.key;mon.hp=f.maxHp(mon);f.S.mons.push(mon);f.registerDex(id,!1,reg.key)}done[reg.key]=1;f.save()}function legacyRegionDexRewards(adv){for(const reg of g.REGIONS){if(!reg.dex)continue;const chapters=g.chaptersOf(reg.key).filter(i=>g.CHAPTERS[i].league),four=chapters.filter(i=>!g.CHAPTERS[i].steps.some(s=>s.kind==="gym"&&s.champion));if(four.length>=4&&(adv.unlocked>four[3]||adv.paidLeaders?.[`${four[3]}:${g.CHAPTERS[four[3]].steps.find(s=>s.kind==="gym")?.leader}`]))regionDexReward(reg)}}';
replace('function M(){f.S.adv||(f.S.adv=v(),_e(0));', helper+'function M(){f.S.adv||(f.S.adv=v(),_e(0));');
replace('if(lt(),m.tower&&!Me(m)?.run())', 'if(lt(),legacyRegionDexRewards(m),m.tower&&!Me(m)?.run())');
replace('En=m.gym),t.BadgeShine?.sync();', 'En=m.gym),!_t&&!Ne.event&&!Ne.zone&&!Ne.tower&&!Ne.league&&m.kind==="gym"&&xa&&(()=>{const reg=g.regionOf(Ne.chapter),four=g.chaptersOf(reg.key).filter(i=>g.CHAPTERS[i].league&&!g.CHAPTERS[i].steps.some(s=>s.kind==="gym"&&s.champion));if(four.length>=4&&Ne.chapter===four[3])regionDexReward(reg)})(),t.BadgeShine?.sync();');
fs.writeFileSync(file, source);
