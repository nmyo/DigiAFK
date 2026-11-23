// Restore only party HP after victories in story league chapters and elite league runs.
const fs = require('node:fs');
const path = require('node:path');

const original = 'Le.push({type:"victory",kind:m.kind,trainer:m.trainer,sprite:m.sprite,money:un,coins:rs,badge:En,gym:m.gym}),Ne.battle=null,Zn()}return Le}const sn=';
const replacement = 'Le.push({type:"victory",kind:m.kind,trainer:m.trainer,sprite:m.sprite,money:un,coins:rs,badge:En,gym:m.gym}),!Ne.event&&!Ne.zone&&!Ne.tower&&(Ne.league||g.CHAPTERS[Ne.chapter]?.league)&&f.teamMons().forEach(Xn=>Xn.hp=f.maxHp(Xn)),Ne.battle=null,Zn()}return Le}const sn=';

function patchLeagueHealing(source) {
  const oldCount = source.split(original).length - 1;
  const newCount = source.split(replacement).length - 1;
  if (oldCount + newCount !== 1) throw new Error('Unexpected league victory rule');
  return oldCount ? source.replace(original, replacement) : source;
}
function patchBundle() {
  const file = path.join(__dirname, '..', 'site', 'bundle', 'app.c74e480997.js');
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchLeagueHealing(source);
  if (patched !== source) fs.writeFileSync(file, patched);
  console.log('League victory healing verified.');
}
if (require.main === module) patchBundle();
module.exports = { patchBundle, patchLeagueHealing };
