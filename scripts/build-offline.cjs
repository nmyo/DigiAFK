// Validate and apply offline patches to the repository's existing local bundle.
// No upstream mirror is needed; site/ is the maintained build baseline.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SITE = path.join(__dirname, '..', 'site');
const files = ['boot.js', 'bundle/app.c74e480997.js', 'bundle/vendor-supabase.8596965fe9.js', 'bundle/lang-zh-Hans.2a57ab3291.js', 'bundle/lang-zh-Hant.ff6e3ad523.js', 'version.json'];
if (process.env.DIGIAFK_BUILD_STAGED !== '1') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'digiafk-build-'));
  try {
    fs.cpSync(__dirname, path.join(temp, 'scripts'), { recursive: true });
    fs.cpSync(SITE, path.join(temp, 'site'), { recursive: true });
    const result = spawnSync(process.execPath, [path.join(temp, 'scripts', 'build-offline.cjs')], {
      env: { ...process.env, DIGIAFK_BUILD_STAGED: '1' }, encoding: 'utf8'
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error('Staged offline build failed');
    for (const file of files) fs.copyFileSync(path.join(temp, 'site', file), path.join(SITE, file));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  process.exit(0);
}

const bootPath = path.join(SITE, 'boot.js');
let boot = require('./chinese-only.cjs').patchBoot(fs.readFileSync(bootPath, 'utf8'));
const speedButton = '<button data-speed="4">×3</button>';
const updatedSpeedButton = '<button data-speed="4">×2.5</button>';
if (boot.split(speedButton).length === 2 && !boot.includes(updatedSpeedButton)) {
  boot = boot.replace(speedButton, '<button data-speed="4">×2.5</button>');
} else if (boot.includes(speedButton) || boot.split(updatedSpeedButton).length !== 2) {
  throw new Error('Unexpected speed button');
}
fs.writeFileSync(bootPath, boot);
fs.copyFileSync(path.join(__dirname, 'offline-supabase.js'), path.join(SITE, 'bundle/vendor-supabase.8596965fe9.js'));
require('./chinese-only.cjs').patchApp(path.join(SITE, 'bundle/app.c74e480997.js'));
for (const [lang, file] of [['zh-Hans', 'lang-zh-Hans.2a57ab3291.js'], ['zh-Hant', 'lang-zh-Hant.ff6e3ad523.js']]) {
  require('./chinese-only.cjs').patchTranslations(path.join(SITE, 'bundle', file), lang);
}
require('./patch-link-evolutions.cjs');
require('./patch-shop-prices.cjs');
require('./patch-legendary-difficulty.cjs').patchBundle();
require('./patch-league-healing.cjs').patchBundle();
require('./patch-legendary-healing.cjs').patchBundle();
require('./patch-team-interaction.cjs').patchBundle();
require('./patch-legendary-view.cjs').patchBundle();
require('./patch-wild-weather.cjs').patchBundle();
require('./patch-dex-encounters.cjs');
require('./patch-region-dex-rewards.cjs');
require('./patch-encounter-panel.cjs').patchBundle();
require('./patch-detail-evolution-region.cjs');
require('./patch-unown-translation.cjs').patchBundle();
require('./patch-offline-entries.cjs').patch();
const version = path.join(SITE, 'version.json');
if (!fs.existsSync(version)) fs.writeFileSync(version, JSON.stringify({ v: 'dev' }) + '\n');
console.log('Local offline build complete.');
