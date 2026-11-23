const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
const start = source.indexOf('Le=le((()=>{const pool=Ae(K(h,m.chapter),m.chapter);');
const end = source.indexOf(',h.way?', start);
assert.ok(start >= 0 && end > start, 'real encounter selection found');
const expr = source.slice(start + 'Le=le('.length, end - 1);
const pool = [{id:1,w:1},{id:2,w:1},{id:3,w:0}];
const ctx = {h:{},m:{chapter:0},t:{FORMS:{baseOf:id=>id}},f:{inDex:id=>id===1},K:()=>pool,Ae:x=>x};
const weights = () => vm.runInNewContext(expr,ctx);
let actual = weights();
assert.deepEqual(Array.from(actual, x=>x.w), [1,12,0]);
assert.deepEqual(pool.map(x=>x.w), [1,1,0]);
for (const key of ['event','way','special']) {ctx.h[key]=true;assert.deepEqual(Array.from(weights(),x=>x.w),[1,1,0]);delete ctx.h[key];}
for (const key of ['zone','league']) {ctx.m[key]=true;assert.deepEqual(Array.from(weights(),x=>x.w),[1,1,0]);delete ctx.m[key];}
ctx.f.inDex=()=>true;assert.deepEqual(Array.from(weights(),x=>x.w),[1,1,0]);
ctx.f.inDex=id=>id===1;ctx.t.FORMS.baseOf=id=>id===2?1:id;assert.deepEqual(Array.from(weights(),x=>x.w),[1,1,0]);
console.log('Ordinary encounters favor unregistered species; exclusions and zero weights preserved.');
