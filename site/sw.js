/* 离线缓存。页面本身已经直接加载 ./shell.js，不依赖任何远端域名，
 * 所以这里只负责把本地的脚本、样式和图片存下来，断网 / 弱网时也能打开。
 *
 * 注意：不做跨域重定向，不自动 reload。之前那套「把远端 boot.js 302 到
 * 本地 shell.js」的写法在首次访问时必然抢跑（SW 还没激活，请求已经发出），
 * 远端一旦连不上就直接落到 BOOT_FAIL 的「网络错误」提示上。
 *
 * cache.put 必须 await：Response.clone() 的两支 body 共享同一个 tee，
 * 不等待写入就去读另一支，会让其中一支收到 net::ERR_ABORTED（图片偶发白块）。
 */
const VERSION = 'pc-cache-v4';
const CORE = [
  './',
  './index.html',
  './shell.js',
  './catalog.js',
  './game.js',
  './ui.js',
  './bundle/app.9258c082d1.css',
];

async function put(cache, key, res) {
  try {
    await cache.put(key, res);
  } catch (e) {
    /* 配额满或响应不可缓存：忽略，不影响页面 */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(CORE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await put(cache, url, res);
      } catch (e) { /* 单个文件失败不阻塞安装 */ }
    }));
    await self.skipWaiting();
  })());
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

  // 脚本/样式/页面：网络优先，保证每次打开都是最新版；断网时回退缓存
  if (req.mode === 'navigate' || req.destination === 'script' || req.destination === 'style') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        if (fresh.ok) await put(cache, req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // 图片等静态资源：缓存优先，后台静默更新
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) {
      // 后台静默更新（失败无所谓，绝不影响本次响应）
      fetch(req)
        .then((res) => (res.ok ? cache.put(req, res) : undefined))
        .catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) await put(cache, req, res.clone());
      return res;
    } catch (e) {
      return Response.error();
    }
  })());
});
