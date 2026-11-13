/* 接管原站 shell 页的引导入口。
 *
 * index.html 保持原站字节不变：它的 <body> 是空的，只在 <head> 里
 * 注册本文件并加载远端 boot.js。我们在这里把那个跨域请求重定向到
 * 本地的 shell.js，由它注入界面结构并加载自己的引擎，原站的代码
 * 一行都不会执行。
 *
 * 竞态兜底：boot.js 的请求偶尔会在 SW 激活前发出（此时页面会被远端
 * 接管）。activate 后给本地引导层一个短窗口期，没等到「shell-ready」
 * 消息就把页面重载一次——此时 SW 已控制页面，重载必然走本地引导层。
 * 重载记录只放在 SW 内存里（同一页面不重复触发），不落缓存。
 */
const SHELL = new URL('shell.js', self.registration.scope).href;
const CDN_HOST = 'pokecatch-online.pages.dev';
const CLAIM_WINDOW_MS = 800;

let shellReady = false;
const reloaded = new Set();

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('message', (event) => {
  if (event.data === 'shell-ready') shellReady = true;
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await new Promise((r) => setTimeout(r, CLAIM_WINDOW_MS));
    if (shellReady) return;
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      if (reloaded.has(client.id)) continue;
      reloaded.add(client.id);
      client.navigate(client.url).catch(() => {});
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // 只接管引导入口；原站 bundle 与素材在 app.js 不加载的情况下不会被请求
  if (url.hostname === CDN_HOST) {
    event.respondWith(Response.redirect(SHELL, 302));
  }
});
