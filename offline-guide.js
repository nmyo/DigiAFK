(function () {
  var style = document.createElement('style');
  style.textContent = '.offline-guide{max-width:680px;width:calc(100% - 48px);max-height:80vh;overflow:auto;background:#1b1e2a;color:#eef1f8;border:2px solid #65708a;border-radius:14px;padding:24px;line-height:1.6}.offline-guide::backdrop{background:#000a}.offline-guide h3{margin:20px 0 4px}.offline-guide p{margin:0}.offline-guide button{margin-top:24px;padding:8px 24px;cursor:pointer}';
  document.head.appendChild(style);
  var sections = [
    ['冒险', '队伍会自动战斗和捕捉。新游戏默认选择 3 倍速，可在冒险画面切换；下方显示最近的战斗日志。'],
    ['队伍与电脑', '在队伍页面管理宝可梦、查看详情并调整出战顺序。满足进化条件后可在详情或队伍页面进化。'],
    ['进化', '勇基拉、豪力、隆隆石和鬼斯通达到 46 级后可进化。需要进化石或其他道具的进化仍需对应道具。'],
    ['图鉴', '图鉴记录发现和捕获的宝可梦，可按名称、地区、属性及状态筛选。'],
    ['培育屋', '将宝可梦寄放在培育屋以获得经验和宝可梦蛋；可在孵化器查看进度。'],
    ['交换', '通过侧栏的交换入口查看游戏内可用的交换。'],
    ['商店与背包', '商店出售游戏内道具；冒险页面的背包可查看和使用物品。'],
    ['保存与性能', '游戏会自动保存到当前浏览器。新玩家默认使用省电模式；可在设置中调整性能选项。']
  ];
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest && event.target.closest('#guide-btn');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var dialog = document.createElement('dialog');
    dialog.className = 'offline-guide';
    var title = document.createElement('h2');
    title.textContent = '游戏指南';
    dialog.appendChild(title);
    sections.forEach(function (section) {
      var heading = document.createElement('h3');
      var body = document.createElement('p');
      heading.textContent = section[0];
      body.textContent = section[1];
      dialog.appendChild(heading);
      dialog.appendChild(body);
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.onclick = function () { dialog.close(); };
    dialog.appendChild(close);
    dialog.addEventListener('close', function () { dialog.remove(); });
    document.body.appendChild(dialog);
    dialog.showModal();
  }, true);
})();
