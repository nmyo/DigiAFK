    /* 热更新：轮询 version.json，发现新构建后提示刷新。
       标题页（无进度风险）直接自动刷新，游戏内则显示角标由玩家点击。 */
    (function () {
      var build = document.querySelector('meta[name="pc-build"]');
      var cur = build ? build.content : null, shown = false;
      function banner() {
        if (shown || !document.body || document.getElementById('pc-update')) return;
        shown = true;
        var d = document.createElement('button');
        d.id = 'pc-update';
        d.type = 'button';
        d.textContent = '发现新版本 · 点击更新';
        d.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 16px;border:0;border-radius:999px;' +
          'cursor:pointer;font:600 13px/1 system-ui,-apple-system,sans-serif;color:#fff;background:#e4352b;' +
          'box-shadow:0 6px 20px rgba(0,0,0,.35)';
        d.onclick = function () { location.reload(); };
        document.body.appendChild(d);
      }
      function atTitle() {
        var f = document.querySelector('.title-fx');
        return !!(f && (f.checkVisibility ? f.checkVisibility() : f.offsetParent));
      }
      function check() {
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.v) return;
            if (!cur) { cur = j.v; return; }
            if (j.v === cur) return;
            cur = j.v;
            // 标题页/未开局：直接刷新；游戏中：提示
            if (atTitle()) location.reload();
            else banner();
          })
          .catch(function () {});
      }
      function start() { check(); setInterval(check, 60000); }
      window.__pcHot = { check: check, state: function () { return cur; } };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
      document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function (e) {
          if (!e.data || e.data.type !== 'pc-updated') return;
          if (atTitle()) location.reload();
          else banner();
        });
      }
    })();
