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
    style.textContent = '#save-btn,#guide-btn,.opt-modal [data-p="community"],.opt-modal .op-community,.ti-row{display:none!important}';
    document.head.appendChild(style);

    function setup() {
    var arenaLog = document.getElementById('battle-log');
    var news = document.getElementById('newsbar');
    var social = document.querySelector('#tabs .nav-grp[data-grp="social"]');
    if (!arenaLog || !news) return false;
    if (social) social.hidden = true;
    var labels = {'zh-Hans': '战斗日志', 'zh-Hant': '戰鬥日誌'};
    function updateLabel() {
      if (feed) feed.setAttribute('aria-label', labels[document.documentElement.lang] || labels[window.LANG_PICK && window.LANG_PICK.lang] || labels['zh-Hans']);
    }
    var records = [];
    var feed;
    function install() {
      if (feed && feed.isConnected) return;
      news.replaceChildren();
      feed = document.createElement('div');
      feed.className = 'news-feed';
      feed.setAttribute('role', 'region');
      updateLabel();
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
      install();
      records.push(text);
      if (records.length > 40) records.shift();
      addRow(text);
      while (feed.children.length > 40) feed.firstElementChild.remove();
    }
    new MutationObserver(updateLabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
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
