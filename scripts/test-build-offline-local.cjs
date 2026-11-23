const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'digiafk-local-build-'));
try {
  fs.cpSync(path.join(root, 'scripts'), path.join(temp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(root, 'site'), path.join(temp, 'site'), { recursive: true });
  const files = ['boot.js', 'bundle/app.c74e480997.js', 'bundle/vendor-supabase.8596965fe9.js', 'version.json'];
  const contents = () => files.map(f => fs.readFileSync(path.join(temp, 'site', f)));
  const run = () => spawnSync(process.execPath, ['scripts/build-offline.cjs'], { cwd: temp, encoding: 'utf8' });
  const before = contents();
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(contents(), before, 'local rebuild must preserve the current build');
  const app = path.join(temp, 'site/bundle/app.c74e480997.js');
  fs.writeFileSync(app, 'incompatible bundle');
  const broken = contents();
  const failure = run();
  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /Staged offline build failed/);
  assert.deepEqual(contents(), broken, 'failed staged build must not overwrite files');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log('Local rebuild succeeds without an external mirror; failed staging preserves outputs.');
