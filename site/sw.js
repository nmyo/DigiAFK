/* 离线缓存。页面本身已经直接加载 ./shell.js，不依赖任何远端域名，
 * 所以这里只负责把本地的脚本、样式和图片存下来，断网 / 弱网时也能打开。
 *
 * 注意：不做跨域重定向，不自动 reload。之前那套「把远端 boot.js 302 到
 * 本地 shell.js」的写法在首次访问时必然抢跑（SW 还没激活，请求已经发出），
 * 远端一旦连不上就直接落到 BOOT_FAIL 的「网络错误」提示上。
 */
const VERSION = 'pc-cache-v2';
const CORE = [
  './',
  './index.html',
  './shell.js',
  './catalog.js',
  './game.js',
  './ui.js',
  './bundle/app.9258c082d1.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部资源一律走网络

  // 页面导航：网络优先，保证更新能立刻生效；断网时回退到缓存的首页
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // 静态资源：缓存优先，后台静默更新
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) {
      fetch(req).then((res) => { if (res.ok) cache.put(req, res); }).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return hit || Response.error();
    }
  })());
});
