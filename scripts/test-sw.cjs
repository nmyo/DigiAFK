const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {};
const stores = new Map();
let enumerations = 0;
let cacheEnumerations = 0;
let now = 100000;
class Clock extends Date { static now() { return now; } }
let network = async () => { throw Error('offline'); };
let quotaFull = false;
function cache(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const data = stores.get(name);
  const keyOf = key => typeof key === 'string' && !key.startsWith('http') ? key : (() => { const u = new URL(typeof key === 'string' ? key : key.url); return u.pathname.slice(1) + u.search; })();
  return {
    keys: async () => {
      enumerations++;
      return [...data.keys()];
    },
    match: async key => {
      const value = data.get(keyOf(key));
      return value instanceof Response ? value.clone() : value;
    },
    put: async (key, value) => {
      if (quotaFull) throw new Error('QuotaExceededError');
      key = keyOf(key);
      data.set(key, value);
    },
  };
}
const caches = {
  open: async name => cache(name), keys: async () => { cacheEnumerations++; return [...stores.keys()]; },
  delete: async name => stores.delete(name),
  match: async (key, options) => stores.has(options.cacheName) ? cache(options.cacheName).match(key) : undefined,
};
vm.runInNewContext(fs.readFileSync('site/sw.js', 'utf8'), {
  caches, URL, Response, Request: class { constructor(req) { return req; } }, Date: Clock, fetch: (...args) => network(...args),
  self: { addEventListener: (type, fn) => { handlers[type] = fn; }, location: {origin:'https://example.com'},
    clients: {claim: async () => {}, matchAll: async () => []}, skipWaiting: async () => {} },
});
function dispatch(type, event = {}) {
  let response;
  const pending = [];
  handlers[type]({...event, waitUntil: p => { pending.push(p); }, respondWith: p => { response = p; }});
  return { response, done: Promise.all(pending) };
}
const request = path => ({method:'GET', url:`https://example.com/${path}`, destination:'image'});
(async () => {
  stores.set('other-app', new Map([['image', 'foreign']]));
  stores.set('pc-cache-v16', new Map([['image', 'old-image'], ['script', 'old-script']]));
  stores.set('pc-cache-v20', new Map([['script', 'new-script']]));
  stores.set('pc-cache-v21', new Map([['future', 'future']]));
  stores.set('pc-cache-v016', new Map([['foreign', 'foreign']]));
  stores.get('pc-cache-v16').set('shared', 'newer');
  // Activation retains only the two most recent older versions, without copying assets.
  for (let version = 1; version < 16; version++) {
    stores.set(`pc-cache-v${version}`, new Map([[`asset-${version}`, `old-${version}`]]));
  }
  stores.get('pc-cache-v15').set('shared', 'older');
  await dispatch('activate').done;
  assert.equal(enumerations, 0);
  assert.equal(cacheEnumerations, 1);
  assert.equal(stores.has('pc-cache-v1'), false);
  assert.equal(stores.has('pc-cache-v14'), false);
  assert.equal(stores.has('pc-cache-v15'), true);
  assert.equal(stores.has('pc-cache-v20'), true);
  assert.equal(stores.has('pc-cache-v016'), true);
  assert.equal(stores.has('other-app'), true);
  assert.equal(stores.has('pc-cache-v16'), true);
  assert.equal(stores.get('pc-cache-v20').has('image'), false);
  assert.equal(stores.get('pc-cache-v20').get('script'), 'new-script');
  // Concurrent misses share one refresh, including the fallback lookup.
  now += 60000;
  const concurrent = Array.from({length: 20}, (_, i) => dispatch('fetch', {request: request(`missing-${i}`)}));
  await Promise.all(concurrent.map(async event => { await event.response; await event.done; }));
  assert.equal(cacheEnumerations, 2);
  // A recreated obsolete cache is collected after the interval, not used as fallback.
  stores.set('pc-cache-v1', new Map([['obsolete', 'obsolete']]));
  let beforeInterval = dispatch('fetch', {request: request('obsolete')});
  assert.equal((await beforeInterval.response).type, 'error');
  await beforeInterval.done;
  assert.equal(stores.has('pc-cache-v1'), true);
  assert.equal(cacheEnumerations, 2);
  now += 60000;
  let oldest = dispatch('fetch', {request: request('obsolete')});
  assert.equal((await oldest.response).type, 'error');
  await oldest.done;
  assert.equal(stores.has('pc-cache-v1'), false);
  assert.equal(cacheEnumerations, 3);
  let sorted = dispatch('fetch', {request: request('shared')});
  assert.equal(await sorted.response, 'newer');
  await sorted.done;
  let script = dispatch('fetch', {request: {method:'GET', url:'https://example.com/script', destination:'script'}});
  assert.equal(await script.response, 'new-script');
  await script.done;
  script = dispatch('fetch', {request: {method:'GET', url:'https://example.com/asset-15', destination:'script'}});
  assert.equal(await script.response, 'old-15');
  await script.done;
  network = async () => new Response('server error', {status: 503});
  for (const [path, destination, expected] of [['script', 'script', 'new-script'], ['asset-15', 'style', 'old-15']]) {
    const failed = dispatch('fetch', {request: {method:'GET', url:`https://example.com/${path}`, destination}});
    assert.equal(await failed.response, expected);
    await failed.done;
  }
  let failed = dispatch('fetch', {request: {method:'GET', url:'https://example.com/missing-page', mode:'navigate'}});
  assert.equal((await failed.response).status, 503);
  await failed.done;
  stores.get('pc-cache-v20').set('page', 'plain-page');
  stores.get('pc-cache-v20').set('page?exact=1', 'exact-page');
  stores.get('pc-cache-v16').set('old-page', 'old-page-response');
  for (const [path, expected] of [['page?x=1', 'plain-page'], ['page?exact=1', 'exact-page'], ['old-page?x=1', 'old-page-response']]) {
    const navigation = dispatch('fetch', {request: {method:'GET', url:'https://example.com/' + path, mode:'navigate'}});
    assert.equal(await navigation.response, expected);
    await navigation.done;
  }
  let queryScript = dispatch('fetch', {request: {method:'GET', url:'https://example.com/page?x=1', destination:'script'}});
  assert.equal((await queryScript.response).status, 503);
  await queryScript.done;
  network = async () => { throw Error('offline'); };
  const offlinePage = dispatch('fetch', {request: {method:'GET', url:'https://example.com/page?x=1', mode:'navigate'}});
  assert.equal(await offlinePage.response, 'plain-page');
  await offlinePage.done;
  network = async () => new Response('not found', {status: 404});
  failed = dispatch('fetch', {request: {method:'GET', url:'https://example.com/script', destination:'script'}});
  assert.equal((await failed.response).status, 404);
  await failed.done;
  network = async () => { throw Error('offline'); };
  let foreign = dispatch('fetch', {request: request('foreign')});
  assert.equal((await foreign.response).type, 'error');
  await foreign.done;
  // A prior worker may finish writing even after activation.
  stores.get('pc-cache-v16').set('late', 'late-image');
  let event = dispatch('fetch', {request: request('late')});
  assert.equal(await event.response, 'late-image');
  await event.done;
  event = dispatch('fetch', {request: request('image')});
  assert.equal(await event.response, 'old-image');
  await event.done;

  // A legacy hit is returned immediately, but its lifetime-bound refresh updates
  // the current cache after network recovery, including on the next offline hit.
  let release;
  network = () => new Promise(resolve => { release = resolve; });
  event = dispatch('fetch', {request: request('late')});
  assert.equal(await event.response, 'late-image');
  release(new Response('fresh-image'));
  await event.done;
  assert.equal(await stores.get('pc-cache-v20').get('late').clone().text(), 'fresh-image');
  network = async () => { throw Error('offline'); };
  event = dispatch('fetch', {request: request('late')});
  assert.equal(await (await event.response).text(), 'fresh-image');
  await event.done;
  // Quota failure must not discard a network response or prevent an old offline hit.
  quotaFull = true;
  network = async () => new Response('network-only');
  event = dispatch('fetch', {request: request('quota-miss')});
  assert.equal(await (await event.response).text(), 'network-only');
  await event.done;
  assert.equal(stores.get('pc-cache-v20').has('quota-miss'), false);
  event = dispatch('fetch', {request: request('image')});
  assert.equal(await event.response, 'old-image');
  await event.done;
  network = async () => { throw Error('offline'); };
  event = dispatch('fetch', {request: request('image')});
  assert.equal(await event.response, 'old-image');
  await event.done;
  console.log('Service worker migration, late writes, quota failure, isolation and network recovery verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
