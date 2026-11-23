// Bias only ordinary wild encounters toward species missing from the Pokédex.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'site/bundle/app.c74e480997.js');
const oldText = 'Le=le(Ae(K(h,m.chapter),m.chapter)),h.way?';
const newText = 'Le=le((()=>{const pool=Ae(K(h,m.chapter),m.chapter);return h.event||m.zone||m.league||h.way||h.special?pool:pool.map(x=>({...x,w:x.w*(f.inDex(t.FORMS?.baseOf(x.id)??x.id)?1:12)}))})()),h.way?';
let source = fs.readFileSync(file, 'utf8');
if (!source.includes(newText)) {
  if (source.split(oldText).length !== 2) throw Error('Ordinary wild encounter seam not found');
  source = source.replace(oldText, newText);
  fs.writeFileSync(file, source);
}
