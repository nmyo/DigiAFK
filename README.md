# 数码图鉴 · DigiAFK（等级进化 / JSON 存档版）

基于 [TyoukabuN/DigiAFK](https://github.com/TyoukabuN/DigiAFK) 的完整复刻，保留原项目全部设计与玩法，规则与存档方式做了如下调整：

1. **删除「NPC 交换」（交换进化）**，所有进化只按等级门槛触发。
2. **捕获胶囊改为无限**：移除胶囊消耗与商店售卖，捕获不再需要购买道具；为防止挂机无限刷怪，仓库上限设为 300 只。
3. **存档改为本地 JSON 文件**：不再使用 localStorage，无账号、无云端、无登录。
4. **关闭页面后继续运行**：重新打开存档时按离线时长完整推演战斗、捕获与收益。
5. **重复精灵自动折算**：捕获到已持有的同种个体时不再入库，按等级折算金币并给全队经验；异色优先保留。
6. **后台标签页持续运行**：计时器跑在 Web Worker 中，规避浏览器对后台页面的定时器节流。

## 与原版的差异

| 项目 | 原版 | 本版本 |
| --- | --- | --- |
| 进化方式 | 等级进化（完全体需进化芯片） | 同原版，进化芯片保留 |
| NPC 交换 | 仓库中一只随机换成艾力兽（gate 2 解锁） | **已删除** |
| 艾力兽获取 | 交换或野外遭遇 | 野外遭遇 / 培育屋孵蛋（Ver.2） |
| 捕获道具 | 捕获胶囊，每次胜利消耗 1 个，商店 20 币 / 5 个 | **无限捕获**，无消耗无售卖 |
| 仓库 | 无上限 | 上限 300 只（重复个体不入库，实际很难填满） |
| 重复精灵 | 照常入库 | **自动折算**：金币 1+等级÷3（向下取整），全队获得一份同级战斗经验；异色除外 |
| 存档 | `localStorage` 单槽 | **JSON 文件**（可复制、备份、跨浏览器导入） |
| 离线收益 | 8 小时封顶，仅补金币与经验 | **完整推演**：战斗、捕获、经验、金币，上限 72 小时 |
| 后台运行 | `setInterval` 受后台节流 | Web Worker 计时 + 回前台自动补算 |

其余设计不变：70 条第一世代图鉴（Digital Monster Ver.1–5）、自动战斗与捕获、昼夜/天气遭遇条件、四天王与启示录兽主线、商店（进化芯片、回复补给）、培育屋孵蛋、赌场小游戏、队伍预设与换人排队。

## 存档机制

- **新建冒险**：Chromium 系浏览器会弹出保存对话框，选择位置后生成 `digiafk-save.json`，此后每次推进**自动续写同一个文件**（战斗每 5 秒节流写入，关键操作与页面隐藏/关闭时立即写入）。
- **打开存档文件**：读取 JSON 还原进度，并接管该文件继续自动保存。
- **导出存档**：所有浏览器可用，下载一份 `digiafk-save.json` 快照；Firefox / Safari 等不支持 File System Access API 的浏览器以「导出 + 打开」作为存档方式。
- 存档内容为纯 JSON（`v:1` 版本号 + 队伍/仓库/图鉴/背包/进度/`savedAt`），可直接用文本编辑器查看或纳入 Git 管理。

## 关闭页面后的运行方式

浏览器关闭后页面无法继续执行脚本，因此采用**离线推演**：重新打开存档时，用 `savedAt` 计算离线时长，按与在线一致的 1100ms/回合节奏逐步模拟——遭遇、自动战斗、捕获（捕获免费，受仓库容量约束）、经验与金币结算；练度足够且冷却已过时会自动挑战主线首领。同一存档、同一离线时长的推演结果完全可复现（mulberry32 以 `savedAt` 为种子）。

- 上限 72 小时，超出部分不再累计，日志会标注「超过 72 小时，按上限结算」。
- 结算分块执行（每 3 万回合让出一帧），期间显示进度弹窗，235,636 回合的满额结算约 0.6 秒且页面不卡死。
- 捕获不消耗胶囊、不限次数，改由**仓库容量 300 只**兜底；仓库满后捕获失败，日志会提示。
- 新增**放生**：仓库中的伙伴可释放腾出空间（有确认弹窗，队伍成员不可放生）。
- 重复精灵折算规则见上表；折算次数累计在 `dupes` 字段，队伍页显示统计。
- 在线时页面处于后台标签页，计时器运行在 Worker 中，不受 DOM 定时器节流；回到前台若发现超过 10 秒的缺口，会立即补算一次。

## 路径用途

| 路径 | 用途 |
| --- | --- |
| [site/](site/) | 静态游戏发布目录。首页、精灵图、背景和样式都在这里。 |
| [docs/digimon-prd/](docs/digimon-prd/) | 数码宝贝版产品需求（原版设计记录，未改动）。 |
| [docs/research/](docs/research/) | Poke’Catch 架构与素材调研。 |
| [tests/game.test.cjs](tests/game.test.cjs) | 游戏内核测试：17 个用例，含离线推演、分块结算与纯等级进化。 |
| [scripts/deploy_vercel.py](scripts/deploy_vercel.py) | 通过 Vercel REST API 一键部署（零依赖）。 |
| [netlify.toml](netlify.toml) / [vercel.json](vercel.json) | 静态部署配置，发布目录均为 `site`。 |

## 本地试玩

双击 [site/index.html](site/index.html) 即可（`file://` 下 File System Access 不可用，会自动走导出/导入模式；用本地服务器可获得完整自动保存体验）。

```bash
python3 -m http.server 8080 --directory site
```

## 运行测试

```bash
node --test
```

## 部署

三种方式任选，`vercel.json` 已声明「输出目录 `site`、无构建、无安装依赖」，所以不需要任何构建配置。

### 方式一：REST API 脚本（无需安装 CLI）

项目自带 [scripts/deploy_vercel.py](scripts/deploy_vercel.py)，只用 Python 3 标准库，走官方两个接口：`POST /v2/files` 按 SHA1 上传文件 → `POST /v13/deployments` 创建部署 → 轮询到 `READY`。

```bash
# 1. 生成令牌：https://vercel.com/account/tokens（Scope 选你的账号，过期时间自定）
export VERCEL_TOKEN=xxxxxxxxxxxxxxxx

# 2. 预览部署（默认）
python3 scripts/deploy_vercel.py

# 3. 正式部署
python3 scripts/deploy_vercel.py --prod

# 其他参数
python3 scripts/deploy_vercel.py --project digiafk --team team_xxx --prod
python3 scripts/deploy_vercel.py --dry-run   # 只列出将上传的 15 个文件
```

脚本行为：仅上传 `vercel.json` + `site/`（共约 760 KB），逐个文件带 `x-vercel-digest` 请求头，创建部署时用 `sha` + `size` 引用；`--prod` 对应 `target: production`。首次运行会在你的账号下自动创建名为 `digiafk` 的项目，之后每次都更新同一个项目。令牌也可用 `--token` 传入，便于写进 CI 的 secret。

> CI 里最简写法（GitHub Actions）：
> ```yaml
> - run: python3 scripts/deploy_vercel.py --prod
>   env:
>     VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
> ```

### 方式二：Vercel CLI

```bash
npm i -g vercel
cd DigiAFK
vercel --prod --yes --token $VERCEL_TOKEN
```

### 方式三：Git 集成

把仓库推到 GitHub/GitLab/Bitbucket，在 [vercel.com/new](https://vercel.com/new) 导入：框架选 **Other**，构建命令留空，输出目录 `site`。之后每次 push 自动部署。

### Netlify

手动部署选 `site/` 文件夹；Git 部署时发布目录填 `site`，构建命令留空（`netlify.toml` 已配置）。

> 存档是本地文件，与域名无关，换部署平台不影响进度（把 JSON 文件带走即可）。

## 素材说明

目前的精灵图、背景和样式继承自原项目，用于本地换皮验证。对外发布前应确认这些资源的再分发许可，或换用原创与获授权的素材。
