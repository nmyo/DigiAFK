/* 离线缓存 + 热更新（原站前端本地版）。
 * 页面直接加载本地 boot.js → 原站 app.js/vendor/语言包/素材全部来自本域，
 * Supabase 已在 vendor 尾部被替换为本地游客模式（无任何网络调用）。
 *
 * 热更新策略：
 * - 页面/脚本/样式一律 network-first 且强制校验（cache: 'no-cache'）：
 *   每次向服务器确认，未变则 304 走本地缓存，变了立即取新，兼顾速度与新鲜度。
 * - version.json 每次请求都走网络（no-store），供页面轮询判断是否有新构建。
 * - 新 SW 接管后向页面广播 pc-updated 消息。
 */
const VERSION = 'pc-cache-v16';
const CORE = [
  './',
  './index.html',
  './boot.js',
  './offline-ui.js',
  './bundle/app.c74e480997.js',
  './bundle/vendor-supabase.8596965fe9.js',
  './bundle/app.9258c082d1.css',
  './bundle/lang-zh-Hans.2a57ab3291.js',
  './bundle/lang-en.d1eee1a2ce.js',
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
    // 通知已打开的页面：新版本已接管
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => { try { c.postMessage({ type: 'pc-updated' }); } catch (e) {} });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 防御：任何对旧云端的请求一律快速失败（mock 已保证不会发出）
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'pokecatch-online.pages.dev') {
    event.respondWith(Response.error());
    return;
  }
  if (url.origin !== self.location.origin) return; // 其余外部资源走网络

  // 版本文件：永远走网络（no-store），供页面判断是否有新构建
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith((async () => {
      try {
        return await fetch(req, { cache: 'no-store' });
      } catch (e) {
        return Response.error();
      }
    })());
    return;
  }

  // 页面/脚本/样式：网络优先 + 强制校验（304 复用），部署后立即生效；断网回退缓存
  if (req.mode === 'navigate' || req.destination === 'script' || req.destination === 'style') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(new Request(req, { cache: 'no-cache' }));
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
