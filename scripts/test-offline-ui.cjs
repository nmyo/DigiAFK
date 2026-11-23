const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('site/offline-ui.js', 'utf8');
function run(initial) {
  const values = new Map(initial ? [['pokecatch-perf', initial]] : []);
  const callbacks = {};
  const context = {
    localStorage: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
    document: { addEventListener: (name, fn) => { callbacks[name] = fn; } },
    MutationObserver: class {},
  };
  vm.runInNewContext(source, context);
  return values;
}
assert.equal(JSON.parse(run().get('pokecatch-perf')).calm, true);
const custom = '{"calm":false,"weather":true}';
assert.equal(run(custom).get('pokecatch-perf'), custom);
console.log('Default eco mode and existing preferences verified.');

// Simulate a feed being removed immediately before a log mutation.
{
  const observers = [];
  class Element {
    constructor() { this.children = []; this.isConnected = true; this.textContent = ''; this.attributes = {}; }
    appendChild(child) { this.children.push(child); child.isConnected = true; return child; }
    replaceChildren() { this.children.forEach(child => { child.isConnected = false; }); this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    insertBefore() {}
    querySelector() { return trade; }
  }
  const log = new Element(), news = new Element(), social = new Element(), trade = new Element();
  social.parentNode = new Element();
  const callbacks = {};
  const document = {
    head: new Element(), body: new Element(), documentElement: {lang: 'fr'},
    createElement: () => new Element(),
    getElementById: id => id === 'battle-log' ? log : news,
    querySelector: () => social,
    addEventListener: (name, fn) => { callbacks[name] = fn; },
  };
  class Observer { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} }
  vm.runInNewContext(source, {document, window: {LANG_PICK: {lang: 'fr'}}, MutationObserver: Observer, localStorage: {getItem: () => 'saved'}});
  callbacks.DOMContentLoaded();
  assert.equal(news.children[0].attributes['aria-label'], '战斗日志');
  assert.equal(news.children[0].attributes.role, 'region');
  document.documentElement.lang = 'zh-Hant'; observers[0].fn();
  assert.equal(news.children[0].attributes['aria-label'], '戰鬥日誌');
  log.textContent = 'first'; observers[1].fn();
  news.replaceChildren();
  log.textContent = 'second'; observers[1].fn();
  assert.equal(news.children[0].attributes['aria-label'], '戰鬥日誌');
  assert.deepEqual(news.children[0].children.map(row => row.textContent), ['first', 'second']);
}
