# Poke'Catch 单机离线版

原站 [Poke'Catch](https://pokecatch-online.pages.dev/) 的**完全离线单机版**：前端 100% 使用原站代码
（含中文语言包与全部素材），仅把 Supabase 后端替换为本地游客模式——**无账号、无云端、无任何网络请求**，
进度由原站自身的游客存档机制保存在浏览器 localStorage（`pokecatch-anon`）。

## 架构

```
index.html（原站 shell 页，仅 3 行适配）
 └─ ./boot.js        ← 原 boot.js，仅把 CDN 域替换为部署根（new URL('.',location)）
     ├─ bundle/app.9258c082d1.css      原站样式（内嵌像素字体）
     ├─ bundle/vendor-supabase.*.js    原 vendor 库 + 尾部追加的游客 mock
     │    └─ createClient 被替换为「永远未登录 + 全部调用静默空转」
     ├─ bundle/app.c74e480997.js       原站游戏逻辑 + 本地规则补丁
     ├─ bundle/lang-*.js               8 语言包（zh 浏览器自动中文）
     └─ assets/                        原站素材 2200+（精灵/道具/UI/场景）
```

离线适配层改动：

1. `index.html`：SW 注册相对路径、脚本指向本地 `./boot.js`、保留 BOOT_FAIL 兜底
2. `boot.js`：文本替换 `https://pokecatch-online.pages.dev/` → `""+(new URL(".",location))+"`（12 处）
3. `vendor-supabase.js`：文件尾部追加游客 mock（不联网、不登录、社交功能空数据）

本地规则补丁将四种通信进化改为 46 级进化、默认速度设为 4。主线普通道馆战的敌方 HP 和伤害降为原来的 50%；联盟、活动、区域、塔及精英战不受此道馆补丁影响。常规传奇区域遭遇的敌方 HP 降为原来的 25%，其中急冻鸟（144）的基础 HP 倍率另从 3.74 降至 3.37、火焰鸟（146）从 34.18 降至 30.76；该区域的传奇及幻之宝可梦捕获率设为 76.5（实际基础概率 30%）。精英、团体战和世界 Boss 不受传奇区域补丁影响；区域外的传奇捕获规则不变。重建时会重新校验并应用这些补丁。

## 本地试玩

```bash
cd site && python3 -m http.server 8080   # 打开 http://localhost:8080
```

## 部署

- **GitHub Pages**（推荐，国内可直连）：`bash scripts/deploy-pages.sh` → <https://nmyo.github.io/DigiAFK/>
- 重建离线 bundle：`node scripts/build-offline.cjs`（从 `../pokecatch-mirror` 生成）
- ⚠️ `*.vercel.app` 默认域名在国内被 DNS 污染 + SNI 阻断，需绑定自有域名才能访问

> 个人非商用粉丝项目。宝可梦相关名称与素材归 Nintendo / Game Freak / Creatures 所有；
> 前端代码与素材来自 Poke'Catch 原站。
