const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['site/boot.js', 'site/bundle/app.c74e480997.js', 'site/version.json'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const before = files.map(hash);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'digiafk-mirror-'));
try {
  const result = spawnSync(process.execPath, ['scripts/build-offline.cjs', path.join(temp, 'missing')], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Mirror not found/);
  assert.deepEqual(files.map(hash), before);

  const fake = path.join(temp, 'fake');
  fs.mkdirSync(path.join(fake, 'bundle'), { recursive: true });
  fs.writeFileSync(path.join(fake, 'boot.js'), 'bundle/app.wrong.js');
  const incompatible = spawnSync(process.execPath, ['scripts/build-offline.cjs', fake], { cwd: root, encoding: 'utf8' });
  assert.notEqual(incompatible.status, 0);
  assert.match(incompatible.stderr, /Incompatible mirror boot bundle references/);
  assert.deepEqual(files.map(hash), before);

  const pinned = ['app.c74e480997.js', 'app.9258c082d1.css', 'vendor-supabase.8596965fe9.js', 'lang-zh-Hans.2a57ab3291.js', 'lang-zh-Hant.ff6e3ad523.js'];
  for (const file of pinned) fs.copyFileSync(path.join(root, 'site', 'bundle', file), path.join(fake, 'bundle', file));
  fs.writeFileSync(path.join(fake, 'boot.js'), pinned.map(f => 'bundle/' + f).join('\n'));
  const broken = spawnSync(process.execPath, ['scripts/build-offline.cjs', fake], { cwd: root, encoding: 'utf8' });
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /Staged offline build failed/);
  assert.deepEqual(files.map(hash), before);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('Missing and incompatible mirrors fail without overwriting existing outputs.');
