# DigiAFK 架构与设计（现状）

本文依据仓库当前实现整理；路径均相对仓库根目录。这里的「构建」是对已有发布文件的校验与补丁，不是从上游源码编译。历史方案 `docs/offline-refactor-design.md` 自称待实施计划，不应作为现状依据；`site/index.html` 中有关原 CDN/Netlify 的注释也保留了上游背景，而非当前资源流。

## 系统边界与数据流

这是以 Poke'Catch 上游压缩前端和素材为基线的静态单机站点，没有本项目的应用服务器或云存档。浏览器执行游戏逻辑，静态托管只提供文件。入口和依赖如下：

```text
静态服务器 → site/index.html
  ├─ 注册 site/sw.js；定义启动失败提示
  ├─ site/offline-ui.js：本地性能默认值、隐藏入口、战斗日志
  ├─ site/update-notice.js：版本检测及刷新提示
  └─ site/boot.js：页面骨架、语言与资源加载
       ├─ site/bundle/app.9258c082d1.css
       ├─ site/bundle/vendor-supabase.8596965fe9.js（游客替身）
       ├─ site/bundle/lang-zh-Hans.2a57ab3291.js 或 lang-zh-Hant.ff6e3ad523.js
       └─ site/bundle/app.c74e480997.js → site/assets/ 等本地资源
游戏状态 ↔ 浏览器 localStorage；SW ↔ Cache Storage；版本提示 ← version.json
```

`boot.js` 以 `new URL('.', location)` 解析部署目录，支持相对路径部署；语言仅提供简体和繁体，旧非中文偏好回退简体。上游压缩包仍含法语原文及部分多语言代码。入口按顺序加载离线界面、更新模块和 boot；启动资源失败时调用 `BOOT_FAIL`。SW 注册失败被捕获，因此注册失败本身不保证离线可用。

### 存档与游客后端

游戏存档使用 localStorage 的 `gachamon-save-v1`，浏览器冒烟脚本检查其训练师数据重载；`pokecatch-anon` 是匿名用户标识，并非存档本身。README 当前对此键的描述有误，不应仅备份该标识来恢复进度。偏好例如 `pokecatch.lang`、`pokecatch.theme` 和 `pokecatch-perf` 也是本地保存；性能默认值仅在该键不存在时写入。localStorage 按浏览器来源隔离，清除站点数据、隐私模式、配额或存储被禁用都可能导致进度不可用或丢失；换域名、协议或端口不自动迁移。Cache Storage 缓存资源，不是存档备份。

`scripts/offline-supabase.js` 是游客替身维护源，构建时复制到上述 vendor 文件。它提供兼容的 `window.supabase.createClient` 接口：会话为空，查询和常见 RPC 返回空数据，部分存储/函数操作返回离线错误，不提供账号、云同步或真实社交服务。界面隐藏若干登录和社交入口；隐藏不等于删除上游功能。`offline-ui.js` 监听战斗提示，显示最多 40 条内存日志；该日志不是持久存档。

## 离线缓存与更新

`site/sw.js` 的缓存版本为 `pc-cache-v19`。安装时逐项尝试预缓存页面、脚本、样式和中文包，单项失败不阻止安装；图片等素材通常在访问时缓存，故首次访问后并不保证全部素材离线可用，浏览器也可能回收缓存。激活时接管页面并发送 `pc-updated`；仅管理规范命名的旧缓存，保留最近两个旧版本，更老页面可能失去离线资源。

- 同源页面、脚本、样式网络优先并用 `no-cache` 校验；网络异常或 5xx 时尝试缓存回退，带查询串的导航还可回退无查询串页面。
- 其他同源 GET 资源缓存优先，命中后后台更新；未命中则联网获取。`version.json` 始终网络 `no-store`，离线时不回退旧版本。
- SW 拦截旧上游域名及 Supabase 域名请求并快速失败；其他跨域请求不由此策略处理。游客替身本身不发网络请求，但不能据此推断所有外部请求均被禁止。

`site/update-notice.js` 在启动、每 60 秒、页面重新可见时检查版本；标题页发现变化自动刷新，游戏中显示按钮，收到 SW 更新消息也采用相同提示策略。页面可由 `pc-build` meta 提供初始构建号；没有时以第一次成功取得的版本为基线。仓库 `site/version.json` 为 `dev`，因此未生成唯一版本的部署不一定检测到更新。

## 补丁与维护

`scripts/build-offline.cjs` 以仓库 `site/` 为基线：复制 `scripts/` 和 `site/` 到临时目录，运行补丁；成功后仅复制 `boot.js`、游戏 bundle、vendor 和 `version.json` 回源目录，失败不执行复制。补丁针对压缩文本的特定片段和数量检查，通常识别已应用状态；上游包变化可能使其明确失败，不能假设适配新版本。构建需要 Node.js，不需要外部镜像；它会写入上述文件，运行前应检查工作区并审阅差异。

关键规则及对应脚本：

| 范围 | 维护入口与行为 |
| --- | --- |
| 中文与速度 | `scripts/chinese-only.cjs` 限定语言；构建脚本调整最高速度按钮标记为 ×2.5（保存值 4）。 |
| 进化与经济 | `scripts/patch-link-evolutions.cjs` 为现有通信进化提供 46 级路径；`scripts/patch-shop-prices.cjs` 调整普通金币商店价格，其他货币不变。具体分支和限制见 `README.md`。 |
| 战斗难度与治疗 | `scripts/patch-legendary-difficulty.cjs` 处理普通道馆和常规传奇区域的倍率及捕获；`scripts/patch-legendary-healing.cjs` 在普通传奇战开始恢复出战队伍 HP；`scripts/patch-league-healing.cjs` 在符合条件的联盟胜利后恢复队伍 HP。精确条件以脚本为准。 |
| 遭遇与界面 | `scripts/patch-wild-weather.cjs` 去除天气对野生遭遇筛选及权重的影响但保留其他条件和战斗天气；`scripts/patch-encounter-panel.cjs` 简化普通区域列表。`scripts/patch-legendary-view.cjs` 移除传奇队伍排行榜视图，保留区域热门队伍相关逻辑。 |
| 交互与翻译 | `scripts/patch-team-interaction.cjs` 避免取消指针手势时提交拖动；`scripts/patch-unown-translation.cjs` 让未知图腾形态共享基础翻译字段。 |

维护时先定位脚本的原文、替换文和断言，修改规则后运行对应测试及本地构建测试；检查生成文件和 SW 核心列表是否一致。不要只手改生成的 vendor：下次构建会从 `scripts/offline-supabase.js` 覆盖。压缩包耦合和文本锚点意味着更新上游需要重新核对规则、资源、存档兼容性与浏览器行为。

## 本地运行与验证

从仓库根目录启动静态服务：

```sh
cd site && python3 -m http.server 8080
```

访问 `http://localhost:8080/`；SW 需要浏览器支持及安全上下文（localhost 可用于本地开发）。验证构建可在根目录执行 `node scripts/build-offline.cjs`；如只需测试构建行为，`node scripts/test-build-offline-local.cjs` 使用临时副本并检查重复构建及失败保护。

测试是独立 Node 脚本而非统一测试运行器，例如：

```sh
for f in scripts/test-*.cjs; do node "$f" || break; done
node scripts/check-assets.cjs
node scripts/check-link-evolutions.cjs
node scripts/check-art-assets.cjs
node scripts/check-trainer-assets.cjs
node scripts/check-sprite-dimensions.cjs
```

`test-*.cjs` 覆盖 SW、更新、启动失败、游客替身、UI 和各规则补丁；素材检查覆盖不同资源集合，`check-assets.cjs` 仅检查 bundle 中字面量图片引用，不证明动态路径完整。`scripts/browser-smoke.cjs` 是另外的真实浏览器冒烟脚本，依赖已在 8765 端口运行的站点和 9222 端口 Chrome 调试接口，以及支持全局 WebSocket 的 Node；它不自行启动或清理服务/浏览器，会操作该浏览器的本地数据，应使用隔离配置。自动脚本不能替代根路径与子路径、断网重载、存档恢复及目标设备上的手工检查。

## 部署

- `scripts/deploy-pages.sh` 将当前 `site/` 复制到临时目录，写入同一构建号的 `version.json` 和页面 `pc-build` meta，初始化临时 `gh-pages` 仓库并强制推送到 origin；它不会先运行构建或测试，执行需推送凭据，会覆盖远端分支。部署 URL 和限制见 `README.md`。
- `netlify.toml` 发布 `site`；`vercel.json` 指定 `site` 输出、无构建/安装命令，并为 assets 设置缓存头。`scripts/deploy_vercel.py` 使用 Vercel API 上传站点，可先用 `--dry-run` 列表；真实部署需要令牌。上述方式默认不注入唯一构建号，若依赖版本轮询，需自行同时生成匹配的页面 meta 与版本文件。
- 部署后应检查实际子路径、资源与 SW 作用域、更新提示和离线回退；静态服务器、浏览器缓存策略及网络环境会影响结果。

## 限制和建议（非现有功能承诺）

1. 建议发布前备份重要本地存档、在隔离浏览器中测试升级与回滚；当前没有云备份或跨来源迁移机制。
2. 建议将浏览器冒烟测试的服务和浏览器生命周期自动化，并增加子路径和离线端到端覆盖；现有历史设计文档中的计划不代表这些能力已实现。
3. 建议每次调整运行时依赖时同步审查 SW 核心资源和版本策略；预缓存尽力而为，不能作为完整离线包保证。
4. 本项目为非商用粉丝项目，上游代码与素材及宝可梦相关权利归属说明见 `README.md`。
