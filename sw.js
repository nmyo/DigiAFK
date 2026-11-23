/* 离线缓存 + 热更新（原站前端本地版）。
 * 页面直接加载本地 boot.js → 原站 app.js/vendor/语言包/素材全部来自本域，
 * Supabase vendor 已由独立本地游客适配器替换（无任何网络调用）。
 *
 * 热更新策略：
 * - 页面/脚本/样式一律 network-first 且强制校验（cache: 'no-cache'）：
 *   每次向服务器确认，未变则 304 走本地缓存，变了立即取新，兼顾速度与新鲜度。
 * - version.json 每次请求都走网络（no-store），供页面轮询判断是否有新构建。
 * - 新 SW 接管后向页面广播 pc-updated 消息。
 */
const VERSION = 'pc-cache-v19';
const CORE = [
  './',
  './index.html',
  './boot.js',
  './offline-ui.js',
  './update-notice.js',
  './bundle/app.c74e480997.js',
  './bundle/vendor-supabase.8596965fe9.js',
  './bundle/app.9258c082d1.css',
  './bundle/lang-zh-Hans.2a57ab3291.js',
  './bundle/lang-zh-Hant.ff6e3ad523.js',
];

// 合并并发枚举，并定期重新检查旧 worker 迟到创建的缓存。
const CLEANUP_INTERVAL = 60 * 1000;
let retainedPromise;
let lastCleanup = 0;

function retainedOldVersions(force = false) {
  if (retainedPromise && (lastCleanup === 0 || (!force && Date.now() - lastCleanup < CLEANUP_INTERVAL))) {
    return retainedPromise;
  }
  lastCleanup = 0;
  retainedPromise = cleanupOldVersions().then((versions) => {
    lastCleanup = Date.now();
    return versions;
  }, (error) => {
    retainedPromise = undefined;
    throw error;
  });
  return retainedPromise;
}

// 只管理本应用的规范版本名；未来版本可能属于另一个正在运行的 worker。
async function cleanupOldVersions() {
  const current = BigInt(VERSION.slice(10));
  const old = (await caches.keys()).filter((key) => /^pc-cache-v(0|[1-9][0-9]*)$/.test(key) && BigInt(key.slice(10)) < current)
    .sort((a, b) => BigInt(a.slice(10)) > BigInt(b.slice(10)) ? -1 : 1);
  await Promise.all(old.slice(2).map((key) => caches.delete(key)));
  return old.slice(0, 2);
}

async function matchRetained(req) {
  const hit = await caches.match(req, { cacheName: VERSION });
  if (hit) return hit;
  for (const key of await retainedOldVersions()) {
    // match 不会像 open 一样在并发删除后重新创建空缓存。
    const oldHit = await caches.match(req, { cacheName: key });
    if (oldHit) return oldHit;
  }
}

async function matchPageFallback(req) {
  const exact = await matchRetained(req);
  if (exact || req.mode !== 'navigate') return exact;
  const url = new URL(req.url);
  if (!url.search) return;
  url.search = '';
  return matchRetained(url.href);
}

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
    // 最多保留最近两个旧版本；更老页面的离线资源可能因此丢失。
    await retainedOldVersions(true);
    await self.clients.claim();
    // 通知已打开的页面：新版本已接管
    const list = await self.clients.matchAll({ type: 'window' });
    list.forEach((c) => { try { c.postMessage({ type: 'pc-updated' }); } catch (e) {} });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 旧 worker 可能在激活后重新创建旧缓存；后续请求定期回收。
  event.waitUntil(retainedOldVersions().catch(() => {}));
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
        if (fresh.status >= 500 && fresh.status <= 599) return (await matchPageFallback(req)) || fresh;
        const cache = await caches.open(VERSION);
        if (fresh.ok) await put(cache, req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await matchPageFallback(req)) || Response.error();
      }
    })());
    return;
  }

  // 图片等静态资源：缓存优先，后台静默更新
  const result = (async () => {
    const cache = await caches.open(VERSION);
    const hit = await matchRetained(req);
    if (hit) {
      const update = fetch(req)
        .then((res) => (res.ok ? put(cache, req, res) : undefined))
        .catch(() => {});
      return { response: hit, update };
    }
    try {
      const res = await fetch(req);
      if (res.ok) await put(cache, req, res.clone());
      return { response: res };
    } catch (e) {
      return { response: Response.error() };
    }
  })();
  event.respondWith(result.then(({ response }) => response));
  event.waitUntil(result.then(({ update }) => update).catch(() => {}));
});
