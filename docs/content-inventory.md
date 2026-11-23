# 现有宝可梦与地图内容盘点

本盘点针对当前仓库的 `site/bundle/app.c74e480997.js` 和 `site/assets/`，是扩展前基线，不是新增内容清单或完整性证明。上游代码和素材来自 Poke'Catch；宝可梦名称及素材权属见 [README](../README.md)。仓库不提供可供重新编译的上游数据源；历史 [研究](research/PokeCatch-architecture-research.md) 引用的是另一个上游 bundle，只适合辅助定位。目标作品、版本和素材许可仍须另行确认。

## 物种与文本

- 游戏包的 `t.POKEDEX=[...]` 字面数组有 **493 条、493 个不同 ID**，范围 1–493；范围和数量一起表明这个基础数组内每个整数 ID 恰好出现一次。每项包括 `id`、`key`、属性、基础数值、捕获率和学习招式等。此数不包括初始化时附加的形态，也不说明全部可遭遇或可捕获。
- `t.UNOWN` 等运行时代码会追加形态；`scripts/test-unown-translation.cjs` 验证未知图腾基础种及其 27 个形态的翻译处理。素材文件名也有形态 ID（如 `20101.png`），但不能以图片数量推断运行时物种或形态的总数。形态 ID 分配、其他特殊物种和存档引用仍需逐项追踪。
- `site/bundle/lang-zh-Hans.2a57ab3291.js` 和 `lang-zh-Hant.ff6e3ad523.js` 的 `window.I18N_DATA` 各有 493 个 `pokemon` 键；键数本身不保证名称、介绍的内容完整或覆盖额外形态。翻译应用及未知图腾的处理可参考上述测试。
- `site/assets/pokemon/` 有数字命名的普通图片，以及 `shiny/`、`art/`、`pmd/` 等目录；`scripts/check-art-assets.cjs` 检查已有静态立绘是否有对应动画，并不检查所有物种都有素材。素材与使用许可、图片 URL 和回退规则须在导入前核实。

## 地图与遭遇

`t.STORY` 中的 `CHAPTERS` 是按顺序排列的章节，每章含 `name`、显示用 `region` 和 `steps`；节点有 `kind`、名称，路线节点可含 `bg`、`areas`、等级等。按下方方法对字面数组统计有 **66 章、461 个 step**，其中 `route` 211、`heal` 122、`gym` 65，另有 `gift` 19、`find` 7、`static` 12、`unlock` 2、`trade` 3、`egg` 4、`trainer` 16。这里是节点数，不是不同地理地点数；名称可重复，章节包括联盟及剧情，不代表 66 张地图。章节文本可见关都、城都、丰缘和神奥相关路线，不能据此宣称这些地区的原作地图完整覆盖。

遭遇与节点并非一一等同：节点的 `areas` 引用区域键，`t.STORY` 同一对象中还包含相关区域数据；游戏配置及运行时逻辑另有条件和过滤。`scripts/test-wild-weather.cjs` 与相应补丁是天气、昼夜等行为的证据入口；仅统计路线不能确定可遇物种或可达性。背景素材位于 `site/assets/bg/`，其中 `scenes/`、`underground/` 等资源也不等于地图清单。特殊区域、传奇、剧情节点、解锁及存档进度仍需单独验证。

## 只读复盘

在仓库根目录运行以下 Node 命令；它从当前 bundle 提取两个数组，执行仓库内的数组字面量而不是加载整套游戏。仅对可信的本地仓库运行。章节中 `t.UNOWN.ids` 的展开用空数组代替，因此统计章节和 step 不受影响，**不可用此结果盘点遭遇内容**。脚本在锚点或数组结构改变时应失败或重新审查，不能视为通用 JS 解析器。

```sh
node <<'NODE'
const fs = require('node:fs'), vm = require('node:vm');
const s = fs.readFileSync('site/bundle/app.c74e480997.js', 'utf8');
function array(anchor) {
  const pos = s.indexOf(anchor);
  if (pos < 0) throw Error('missing anchor: ' + anchor);
  const start = pos + anchor.length;
  if (s[start] !== '[') throw Error('not an array: ' + anchor);
  let depth = 0, quote = '', escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return s.slice(start, i + 1);
  }
  throw Error('unclosed array: ' + anchor);
}
const dex = vm.runInNewContext('(' + array('t.POKEDEX=') + ')');
const chapters = vm.runInNewContext('(' + array('CHAPTERS:') + ')', {t: {UNOWN: {ids: []}}});
const ids = dex.map(p => p.id), steps = chapters.flatMap(c => c.steps);
console.log('POKEDEX entries, unique IDs, min, max:', ids.length, new Set(ids).size, Math.min(...ids), Math.max(...ids));
console.log('chapters, steps:', chapters.length, steps.length);
console.log('step kinds:', steps.reduce((m, x) => (m[x.kind] = (m[x.kind] || 0) + 1, m), {}));
console.log('chapter names and region labels:', chapters.map((c, i) => [i, c.name, c.region]));
for (const file of ['lang-zh-Hans.2a57ab3291.js', 'lang-zh-Hant.ff6e3ad523.js']) {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync('site/bundle/' + file, 'utf8'), context);
  const data = Object.values(context.window.I18N_DATA)[0];
  console.log(file, 'pokemon keys:', Object.keys(data.pokemon).length);
}
NODE
```

后续需要用真实运行时逐项核对物种/形态、区域引用与可达性、存档 ID、语言字段和素材许可，再与明确的目标清单比较；不要仅依据连续 ID 或节点数量判定缺失内容。不要修改或删除既有数据来消除表面重复。
