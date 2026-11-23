/* 生成离线单机版：
 * 1) site/boot.js        —— 原 boot.js，仅把 CDN 域名替换为「当前部署根地址」
 * 2) site/bundle/vendor-supabase.*.js —— 独立本地游客适配器
 *    （createClient 被替换为「永远未登录 + 全部调用空转」的客户端）
 * 原站 JS 的任何逻辑都不修改。
 */
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
// Pass the original mirror directory as the first argument.
const MIRROR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'pokecatch-mirror'));
if (!fs.existsSync(path.join(MIRROR, 'boot.js')) || !fs.existsSync(path.join(MIRROR, 'bundle'))) {
  throw new Error(`Mirror not found at ${MIRROR}; pass its path as the first argument`);
}
const CDN = 'https://pokecatch-online.pages.dev/';
// 部署根目录（支持子路径，如 GitHub Pages /DigiAFK/）
const ROOT = '"+(new URL(".",location))+"';

fs.mkdirSync(path.join(SITE, 'bundle'), { recursive: true });

// ---- 1) boot.js 本地化 ----
let boot = fs.readFileSync(path.join(MIRROR, 'boot.js'), 'utf-8');
const n = boot.split(CDN).length - 1;
boot = require('./chinese-only.cjs').patchBoot(boot.split(CDN).join(ROOT));
// Speed setting 4 maps to the game's 2.5x pace, not 3x.
const speedButton = '<button data-speed="4">×3</button>';
if (boot.split(speedButton).length !== 2) throw new Error('Expected speed button not found exactly once');
boot = boot.replace(speedButton, '<button data-speed="4">×2.5</button>');
fs.writeFileSync(path.join(SITE, 'boot.js'), boot);
console.log('boot.js: 替换', n, '处 CDN 引用');

// ---- 2) 本地游客适配器 ----
const adapter = fs.readFileSync(path.join(__dirname, 'offline-supabase.js'), 'utf-8');
for (const f of fs.readdirSync(path.join(MIRROR, 'bundle'))) {
  if (f.startsWith('vendor-supabase') && f.endsWith('.js')) {
    fs.writeFileSync(path.join(SITE, 'bundle', f), adapter);
    console.log('vendor:', f, '→ 本地游客适配器');
  }
}
require('./chinese-only.cjs').patchApp(path.join(SITE, 'bundle', 'app.c74e480997.js'));
require('./patch-link-evolutions.cjs');
require('./patch-shop-prices.cjs');
require('./patch-legendary-difficulty.cjs').patchBundle();
require('./patch-league-healing.cjs').patchBundle();
require('./patch-legendary-healing.cjs').patchBundle();
require('./patch-team-interaction.cjs').patchBundle();
require('./patch-legendary-view.cjs').patchBundle();
console.log('构建完成');

// 本地开发用的版本文件（部署时 scripts/deploy-pages.sh 会覆盖为唯一构建号）
const verPath = path.join(SITE, 'version.json');
if (!fs.existsSync(verPath)) {
  fs.writeFileSync(verPath, JSON.stringify({ v: 'dev' }) + '\n');
  console.log('version.json: 已生成（dev）');
}
