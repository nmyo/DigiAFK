const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'site/bundle/app.c74e480997.js');
let source = fs.readFileSync(file, 'utf8');
function replace(oldText, newText) {
  if (source.includes(newText) && !source.includes(oldText)) return;
  if (source.split(oldText).length !== 2) throw new Error('Unexpected evolution detail renderer');
  source = source.replace(oldText, newText);
}
replace('function Xa(N,{current:Te,shiny:We=!1,reveal:Ke=!1,k:Rt=1,family:ha}={}){const ia=E=>Ke||g.reached(E);', 'function Xa(N,{current:Te,shiny:We=!1,reveal:Ke=!1,k:Rt=1,family:ha,detailRegion:Dr=!1}={}){const region=Dr?t.STORY.REGIONS.find(E=>E.key===g.homeHere()):null,inRegion=E=>{const id=t.FORMS?.baseOf(E)??E;return!!region?.dex&&id>=region.dex[0]&&id<=region.dex[1]};if(Dr&&!inRegion(N))return"";const ia=E=>(!Dr||inRegion(E))&&(Ke||g.reached(E));');
replace('Xa(N,{current:N,k:2})', 'Xa(N,{current:N,k:2,detailRegion:!0})');
fs.writeFileSync(file, source);
