# 积分签到中心 · dsh-checkin-hub

DeepSeek Harness Web GUI 侧边栏插件：把 **WorkBuddy / Trae / Qoder** 三个连接插件的签到与积分能力聚合到一页，支持多账号一键签到、查看余额与使用情况。

## 功能

- **一键全部签到**：顶部按钮依次对三个平台执行号池批量签到（WorkBuddy `/pool?action=checkin`、Trae `/pool?action=checkin`、Qoder `/pool?action=checkin`）。
- **按平台签到**：每个平台卡片右上角单独签到，只处理该平台的账号池。
- **多账号**：每个平台账号池中的账号逐条展示，显示积分余额、今日是否已签到、是否当前账号、是否号池成员、积分到期提示。
- **单账号签到**：Trae 拥有真正的按账号签到接口（`POST /checkin`，body `{accountId}`），行内「单独签到」直接调用；WorkBuddy 与 Qoder 的上游连接插件只提供号池批量签到，行内按钮会落回批量并刷新。
- **加入号池**：连接插件把「加账号」（存凭证）和「入号池」（参与每日签到）分成两件事，新加的账号默认不在号池里。账号行显示「未加入号池」徽标时，点行内「加入号池」即可写进该平台的号池；通过本面板新加的 Qoder PAT 与 OAuth 登录成功的 WorkBuddy 账号会自动入池。
- **余额与使用情况**：卡片头部显示平台积分合计，底部显示已用 / 可用 / 即将过期，点「积分明细」可展开前 6 个积分包（名称、剩余/总量、剩余天数）。
- **添加账号**：WorkBuddy 走浏览器 OAuth（`/oauth?action=start` 打开授权页，每 3 秒轮询 `poll`，成功自动入库）；Qoder 粘贴 PAT（`POST /accounts?action=add`）；Trae 无添加接口，提示先在 Trae 连接插件中登录。
- **移除账号**：二次确认后调用各平台的 `pool?action=remove`（Trae 用 `action=delete` 真正删除账号）。

## 数据来源

插件本身**不保存任何凭证**，也不直接访问平台 API。所有请求都发往本机已安装的连接插件的回环路由：

| 平台 | 路由前缀 |
| --- | --- |
| WorkBuddy | `/plugins/dsh-connect-workbuddy/` |
| Trae | `/plugins/dsh-connect-trae/` |
| Qoder | `/plugins/dsh-connect-qoder/` |

因此这三款工具需要先在插件中心启用各自的连接插件，签到中心只做聚合展示与触发。区域固定传 `region=cn`。

唯一由本插件自己做主机的写操作是号池成员：

```
POST /plugins/dsh-checkin-hub/membership?platform=<workbuddy|trae|qoder>&region=cn
body: {"accountId": "…", "member": true|false}
```

它由插件 host 半边调用 Harness 的 `settings` 服务，只对目标平台 Config 里的 `regions.<region>.pool.memberAccountIds` 数组做一次路径级 `set`，因此不会碰 `targetModelId`、`orderAccountIds`、`probeInputTokens`、`autoCheckin` 这些同槽字段（整槽替换会把它们重置）。Trae 没有 `__save` 路由、客户端也拿不到 `configForms`，这也是本插件能替三个平台统一处理入池的原因。

## 前置条件

- Harness 需要在 **Web GUI** 下运行（`dsh.client.platform` 为 `web`）。
- 三个连接插件需要在插件中心启用：`dsh-connect-workbuddy`、`dsh-connect-trae`、`@dmh2002/dsh-connect-qoder`。未安装时面板不会崩，会显示「连接插件未安装，请先在插件中心启用」。
- 账号需要先在各连接插件里登录（WorkBuddy 登录 / Trae 登录 / Qoder PAT）。本插件不保存任何凭证。
- 账号还要在**号池**里才会被签到。新加的账号默认不入池；面板上会显示「未加入号池」，点该行的「加入号池」即可（等价于在连接插件卡片里勾选成员并保存）。
- 区域目前固定 `region=cn`；国际区账号（WorkBuddy global、Trae ai）会显示未登录。
- 仓库：<https://github.com/fzqfzqfzq/dsh-checkin-hub>

## 安装方式

### 方式一：从 GitHub Release 装（推荐，Windows / macOS / Linux 通用）

```bash
plugin_manager action=install_bundle target=https://github.com/fzqfzqfzq/dsh-checkin-hub/releases/download/v1.1.1/dsh-checkin-hub-1.1.1.tgz
```

这是唯一在三个系统上都不需要本地路径的装法：插件管理器直接下载 tarball 解包，不经过 git，也不要求目标机器装过 git。

### 方式二：直接装 git 仓库

```bash
plugin_manager action=install_bundle target=https://github.com/fzqfzqfzq/dsh-checkin-hub
# 或简写
plugin_manager action=install_bundle target=github:fzqfzqfzq/dsh-checkin-hub
```

Windows 上需要目标机器有可用的 git（pnpm 用 git 克隆，不经过 credential helper）。GitHub 仓库安装前会先做一次 `git ls-remote` 连通性检查，失败时会给出实际执行的命令行和日志路径。

### 方式三：本地 tarball / 本地目录

```bash
# 已经下载了 tgz
plugin_manager action=install_bundle target=/绝对路径/dsh-checkin-hub-1.1.1.tgz

# Windows 示例（必须是绝对路径，反斜杠或正斜杠都可以）
plugin_manager action=install_bundle target=C:\Users\you\Downloads\dsh-checkin-hub-1.1.1.tgz

# 开发时直接指向源码目录（装出来是软链接，改源码即生效）
plugin_manager action=install_bundle target=/绝对路径/dsh-checkin-hub
```

安装后侧边栏出现「积分签到」图标（order 5），点击进入面板。

### 覆盖安装的坑

同一包名已经装过时，插件管理器会返回 `already-installed` 并保留原内容。换版本或换装法必须先移除：

```bash
plugin_manager action=remove_bundle target=dsh-checkin-hub
plugin_manager action=install_bundle target=<新的 spec>
```

### Windows 说明

- 插件本身没有任何与平台相关的代码：Node 侧只有一行日志，界面跑在浏览器里，路径一律交给插件管理器的 spec 解析。
- 需要 **Node 18+**（`engines.node` 已声明）和桌面版 Harness；`dsh.client.platform` 为 `web`，即桌面端内嵌的 Web GUI。
- 只有「方式二」需要 git；从 Release 的 tgz 装不需要。
- 三个连接插件与各自的登录态都是每台机器独立的，需要在那台机器上重新启用并登录。
- 仓库已配置 `.gitattributes`（`* text=auto eol=lf`），避免 Windows 的 CRLF 混进 `client.js` 影响包内容的哈希与比较。

### 发布新版本

```bash
# 1. 改 package.json 的 version
# 2. 本地打包并看校验和（Windows / macOS / Linux 都能跑）
node scripts/pack.mjs

# 3. 打 tag 推上去，GitHub Actions 自动构建并附到 Release
git tag v1.1.2 && git push origin v1.1.2
```

`scripts/pack.mjs` 用 `node:fs` / `node:crypto` 直接算 SHA-256，不依赖 `shasum`、`sed` 这类只在类 Unix 上存在的命令；在 Windows 上通过 `shell: true` 调用 `npm.cmd`。

### 发布到 npm（可选）

包名 `dsh-checkin-hub` 在 npm 上未被占用，`private` 也已去掉，所以想发就能发：

```bash
npm publish
# 之后别人可以
plugin_manager action=install_bundle target=dsh-checkin-hub
```

两个前提：

1. `package.json` 的 `repository` 必须指回本仓库（已配置），npm 包才会与插件市场条目关联；
2. 如果改包名，`cordis.patch.yml` 里 `- insert:` 的 `name` 必须与 `package.json` 的 `name` **完全一致**，否则装完插件不会挂载。

发 npm 的好处是安装免去 `allowBuilds` 构建授权这一步（本插件本来也没有任何构建脚本），市场里还能显示下载量。

## 插件市场

本插件已向 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)（插件市场的收录源）提交条目。收录后，在 Harness 的 **插件 → 发现** 里就能直接搜到并一键安装。

- 条目文件：`data/plugins/fzqfzqfzq__dsh-checkin-hub.yml`（在本仓库的 `market/` 目录留了一份副本）
- 截图由本仓库的 `screenshots.json` 声明，换图只要推这个仓库，不用再提 PR
- 收录 ≠ 安全审查：插件是第三方代码，请只安装你信任的来源

## 结构

```
dsh-checkin-hub/
├── package.json           # dsh.bundle.patch + dsh.client（platform: web）
├── cordis.patch.yml       # - insert: [{ id: dsh-checkin-hub, ... }]
├── index.js               # Host 侧：仅声明挂载
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

## 许可证

MIT，见 [LICENSE](LICENSE)。
