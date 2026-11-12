# 积分签到中心 · dsh-checkin-hub

DeepSeek Harness Web GUI 侧边栏插件：把 **WorkBuddy / Trae / Qoder / MiniMax Code** 四个连接插件的签到与积分能力聚合到一页，支持多账号一键签到、查看余额与使用情况，并可设定**每天几点后自动签到**。

## 功能

- **自动签到**：面板顶部一条「自动签到」条，默认每天 **10:00**（Asia/Shanghai）之后自动为四个平台签到；时间可现场改，可暂停/开启，也可「立即运行」。应用关着时错过的当天会在下次启动后补签。
- **一键全部签到**：顶部按钮依次对四个平台执行签到（WorkBuddy / Trae 走 `/pool?action=checkin`，Qoder 走 `/checkin`，MiniMax 走 `/api/checkin`）。
- **按平台签到**：每个平台卡片右上角单独签到，只处理该平台。
- **多账号**：账号逐条展示积分余额、今日是否已签到、是否当前账号、是否号池成员、积分到期提示。
- **单账号签到**：Trae 有真正的按账号签到接口（`POST /checkin`，body `{accountId}`），行内「单独签到」直接调用；其余平台行内按钮落回批量并刷新。
- **加入号池**：连接插件把「加账号」（存凭证）和「入号池」（参与每日签到）分成两件事。账号行显示「未加入号池」徽标时，点行内「加入号池」即可写进该平台号池。
- **余额与使用情况**：卡片头部显示平台积分合计，底部显示已用 / 可用 / 即将过期，点「积分明细」展开前 6 个积分包（名称、剩余/总量、剩余天数）。
- **添加账号**：WorkBuddy 走浏览器 OAuth（`/oauth?action=start` 打开授权页，每 3 秒轮询 `poll`，成功自动入库并入池）；Trae 无添加接口，提示先在 Trae 连接插件里登录；Qoder 使用连接插件已接管的桌面登录凭据，面板只读展示；MiniMax 使用连接插件已保存的登录态。
- **移除账号**：二次确认后调用各平台的 `pool?action=remove`（Trae 用 `action=delete` 真正删除账号）。

## 数据来源

插件本身**不保存任何凭证**，也不直接访问平台 API。所有请求都发往本机已安装的连接插件的回环路由：

| 平台 | 连接插件 | 路由前缀 |
| --- | --- | --- |
| WorkBuddy | `dsh-connect-workbuddy` | `/plugins/dsh-connect-workbuddy/` |
| Trae | `dsh-connect-trae` | `/plugins/dsh-connect-trae/` |
| Qoder | `@eghrhegpe/dsh-connect-qoder` | `/plugins/dsh-connect-qoder/` |
| MiniMax Code | `dsh-connect-minimax` | `/plugins/dsh-connect-minimax/` |

WorkBuddy / Trae 的区域固定传 `region=cn`；Qoder 使用连接插件自己的区域 id `region=qoder-cn`（0.7.x 只认这个，传 `cn` 会 404）。

### Qoder 的读法

Qoder 连接插件 0.7.x 的两个路由字段是**互补**的：`/usage` 给额度（`regions[].addOnQuota`、`checkin`），`/account` 给登录态与身份（`regions[].state`、`identity`）。本插件在 `load()` 里把两份按区域 id 合并后再渲染，所以「已登录 + 账号名 + 余额 + 今日已签」能同时显示。

### MiniMax 的读法

`/api/signin` 返回 `{account, todayCheckedIn, streakDays, weekPoints, credits}`；`credits` 由连接插件累加 `/minimax-cloud/api/v1/credit/details` 里各积分包的 `remaining_amount` 得出，面板把它作为余额与「积分明细」的数据源。

## 由本插件自己做主机的两个写操作

### 1. 号池成员

```
POST /plugins/dsh-checkin-hub/membership?platform=<workbuddy|trae|qoder>&region=cn
body: {"accountId": "…", "member": true|false}
```

它调用 Harness 的 `settings` 服务，只对目标平台 Config 里的 `regions.<region>.pool.memberAccountIds` 数组做一次路径级 `set`，因此不会碰 `targetModelId`、`orderAccountIds`、`probeInputTokens`、`autoCheckin` 这些同槽字段（整槽替换会把它们重置）。

### 2. 每日自动签到调度器

```
GET  /plugins/dsh-checkin-hub/schedule           # 状态快照
POST /plugins/dsh-checkin-hub/schedule/run       # 立即运行一次
POST /plugins/dsh-checkin-hub/schedule/settings  # {"enabled":bool,"time":"HH:MM","timezone":"Asia/Shanghai"}
```

- 调度器每 60 秒 tick 一次，只在「当天本地时间已过设定时间」且「今天还没跑过」时执行；启动后 5 秒补跑一次。
- 手动「立即运行」若发生在设定时间之前，不会占用当天名额，到点仍会自动跑。
- 状态持久化在 `~/.dsh/daily-checkin/scheduler.json`（可用环境变量 `DSH_CHECKIN_HUB_DATA_DIR` 改目录）：
```json
{"enabled":true,"time":"10:00","timezone":"Asia/Shanghai","lastRunDay":"2026-11-11","lastRunAt":"…","lastResult":[],"lastSummary":{"claimed":0,"already":4,"failed":0}}
```
- 时区换算用 `Intl.DateTimeFormat` 的 `timeZone`，不依赖进程本地时区。

## 前置条件

- Harness 需要在 **Web GUI** 下运行（`dsh.client.platform` 为 `web`）。
- 四个连接插件需要先在插件中心启用：`dsh-connect-workbuddy`、`dsh-connect-trae`、`@eghrhegpe/dsh-connect-qoder`、`dsh-connect-minimax`。未安装的平台卡片不会崩，会显示「连接插件未安装，请先在插件中心启用」。
- 账号需要先在各连接插件里登录。本插件不保存任何凭证。
- 账号还要在**号池**里才会被号池签到。新加的账号默认不入池；面板上会显示「未加入号池」，点该行的「加入号池」即可。
- 仓库：<https://github.com/changtianfeiyun/dsh-checkin-hub>

## 安装方式

### 方式一：从 GitHub Release 装（推荐，Windows / macOS / Linux 通用）

```bash
plugin_manager action=install_bundle target=https://github.com/changtianfeiyun/dsh-checkin-hub/releases/download/v1.2.0/dsh-checkin-hub-1.2.0.tgz
```

插件管理器直接下载 tarball 解包，不经过 git，也不要求目标机器装过 git。

### 方式二：直接装 git 仓库

```bash
plugin_manager action=install_bundle target=https://github.com/changtianfeiyun/dsh-checkin-hub
```

### 方式三：本地 tarball / 本地目录

```bash
# 已经下载了 tgz
plugin_manager action=install_bundle target=/abs/path/dsh-checkin-hub-1.2.0.tgz
# 开发时直接指向源码目录（装出来是软链接，改源码即生效）
plugin_manager action=install_bundle target=/abs/path/dsh-checkin-hub
```

### 覆盖安装的坑

`install_bundle` 对已装插件是**覆盖**：它会先卸掉旧的再装新的，profile 的 `node_modules/dsh-checkin-hub/` 里手改过的文件会被覆盖。要保留本地改动，请改仓库再装。

### Windows 说明

- 装完在 GUI 里 **Ctrl+R** 硬刷新一次，客户端 bundle 才会重新加载（HMR 只对 host 侧 patch 内容变化生效）。
- 面板图标在侧栏「积分签到」。

### 发布新版本

```bash
# 1. 改 package.json 的 version
# 2. 本地打包并看校验和
node scripts/pack.mjs
# 3. 打 tag 推上去，GitHub Actions 自动构建并附到 Release
git tag v1.2.0 && git push origin v1.2.0
```

`scripts/pack.mjs` 用 `node:fs` / `node:crypto` 直接算 SHA-256，不依赖 `shasum`、`sed` 这类只在类 Unix 上存在的命令；在 Windows 上通过 `shell: true` 调用 `npm.cmd`。

## 插件市场

本插件已收录于 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（dshmarket 社区市场的收录源），可在 **插件 → 发现** 里搜到并一键安装。

- 条目文件：`data/plugins/changtianfeiyun__dsh-checkin-hub.yml`（本仓库 `market/` 留了副本）
- 截图由本仓库的 `screenshots.json` 声明，换图只要推这个仓库，不用再提 PR
- 收录 ≠ 安全审查：插件是第三方代码，请只安装你信任的来源

## 结构

```
dsh-checkin-hub/
├── package.json           # dsh.bundle.patch + dsh.client（platform: web）
├── cordis.patch.yml       # - insert: [{ id: dsh-checkin-hub, ... }]
├── index.js               # Host 侧：自动签到调度器 + 号池成员路由
├── client.js              # 侧边栏图标 + 主面板 UI（React，经 window.__ModuleLoader__ 加载）
├── locale/{en,zh}.json    # 插件元数据
├── icon.svg               # 面板图标（SVG）
├── assets/icon-180.png    # 插件市场卡片图标（必须是位图）
├── assets/screenshot-1.png # 市场截图
├── screenshots.json       # 声明市场截图，路径相对本文件
├── market/                # 提交给 awesome-dsh-plugin 的条目副本
├── scripts/pack.mjs       # 跨平台打包 + SHA-256
└── .github/workflows/release.yml   # 打 tag 自动构建 Release
```

界面文案通过 Client locale 服务注册（命名空间 `plugin.dsh-checkin-hub`，内置 zh/en 字典），样式仅使用 `--dsw-alias-*` 主题变量。

## 变更记录

### 1.2.0

- 新增 **MiniMax Code** 平台：签到、连续天数、本周已领积分、余额与积分包明细。
- 新增 **每日自动签到调度器**（host 侧）：默认 10:00 后自动签到，面板可改时间、暂停/开启、立即运行，错过当天会补签。
- 修复 **Qoder 卡片显示「未登录」**：`/usage` 与 `/account` 两份区域数据合并后再渲染；Qoder 路由改用连接插件自己的 `region=qoder-cn`。
- 修复面板右上角「一键全部签到」按钮在深色主题下白底白字（改用 `--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-foreground`）。
- 修复汇总条被 flex 压扁成 1px、自动签到条按钮被挤成两行（`flex:none` + `white-space:nowrap`）。
- 1.1.1 的「加入号池」路由与自动签到调度器共存于同一 host 半边。

### 1.1.1

- 一键把「已登录但未入池」的账号加入号池（`POST /membership`）。

## 许可证

MIT，见 [LICENSE](LICENSE)。
