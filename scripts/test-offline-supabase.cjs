const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const source = fs.readFileSync('scripts/offline-supabase.js', 'utf8');
  assert.equal(fs.readFileSync('site/bundle/vendor-supabase.8596965fe9.js', 'utf8'), source);
  const styles = [];
  const window = {};
  const document = {createElement: () => ({}), documentElement: {appendChild: node => styles.push(node)}};
  vm.runInNewContext(source, {window, document, console, Promise, Error});
  const client = window.supabase.createClient('https://example.supabase.co', 'key');
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.equal((await client.auth.getUser()).data.user, null);
  assert.equal((await client.rpc('friends_list')).data.length, 0);
  assert.equal((await client.rpc('unknown')).data, null);
  assert.equal((await client.from('saves').select('*').eq('id', 'x')).data.length, 0);
  let subscribed = false;
  client.channel('x').on('x', {}, () => {}).subscribe(() => { subscribed = true; });
  assert.equal(subscribed, true);
  assert.equal((await client.storage.from('x').list()).data.length, 0);
  assert.equal(styles.length, 1);
  console.log('Standalone offline Supabase adapter and generated vendor verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
