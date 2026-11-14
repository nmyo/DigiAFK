(function () {
  try {
    if (localStorage.getItem('pokecatch-perf') === null) {
      localStorage.setItem('pokecatch-perf', JSON.stringify({
        calm: true, weather: false, bg: false, glass: false, glint: false, sleep: 120000
      }));
    }
  } catch (_) { /* Storage can be unavailable. */ }

  document.addEventListener('DOMContentLoaded', function () {
    var style = document.createElement('style');
    style.textContent = '#save-btn{display:none!important}';
    document.head.appendChild(style);

    function setup() {
    var arenaLog = document.getElementById('battle-log');
    var news = document.getElementById('newsbar');
    var social = document.querySelector('#tabs .nav-grp[data-grp="social"]');
    var trade = social && social.querySelector('[data-screen="trade"]');
    if (!arenaLog || !news || !social || !trade) return false;
    social.parentNode.insertBefore(trade, social);
    social.hidden = true;
    var records = [];
    var feed;
    function install() {
      if (feed && feed.isConnected) return;
      news.replaceChildren();
      feed = document.createElement('div');
      feed.className = 'news-feed';
      feed.setAttribute('aria-label', '战斗日志');
      news.appendChild(feed);
      records.forEach(addRow);
    }
    function addRow(text) {
      var row = document.createElement('div');
      row.className = 'news-line';
      row.textContent = text;
      feed.appendChild(row);
      feed.scrollTop = feed.scrollHeight;
    }
    var last = '';
    function record() {
      var text = arenaLog.textContent.trim();
      if (!text || text === last) return;
      last = text;
      records.push(text);
      if (records.length > 40) records.shift();
      install();
      addRow(text);
      while (feed.children.length > 40) feed.firstElementChild.remove();
    }
    new MutationObserver(record).observe(arenaLog, { childList: true, subtree: true, characterData: true });
    new MutationObserver(install).observe(news, { childList: true });
    install();
    record();
    return true;
    }
    if (!setup()) {
      var waiting = new MutationObserver(function () {
        if (setup()) waiting.disconnect();
      });
      waiting.observe(document.body, { childList: true, subtree: true });
    }
  });
})();
