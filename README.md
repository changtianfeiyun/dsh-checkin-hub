# 积分签到中心 · dsh-checkin-hub

DeepSeek Harness Web GUI 侧边栏插件：把 **WorkBuddy / Trae / Qoder** 三个连接插件的签到与积分能力聚合到一页，支持多账号一键签到、查看余额与使用情况。

## 功能

- **一键全部签到**：顶部按钮依次对三个平台执行号池批量签到（WorkBuddy `/pool?action=checkin`、Trae `/pool?action=checkin`、Qoder `/pool?action=checkin`）。
- **按平台签到**：每个平台卡片右上角单独签到，只处理该平台的账号池。
- **多账号**：每个平台账号池中的账号逐条展示，显示积分余额、今日是否已签到、是否当前账号、是否号池成员、积分到期提示。
- **单账号签到**：Trae 拥有真正的按账号签到接口（`POST /checkin`，body `{accountId}`），行内「单独签到」直接调用；WorkBuddy 与 Qoder 的上游连接插件只提供号池批量签到，行内按钮会落回批量并刷新。
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

## 前置条件

- Harness 需要在 **Web GUI** 下运行（`dsh.client.platform` 为 `web`）。
- 三个连接插件需要在插件中心启用：`dsh-connect-workbuddy`、`dsh-connect-trae`、`@dmh2002/dsh-connect-qoder`。未安装时面板不会崩，会显示「连接插件未安装，请先在插件中心启用」。
- 账号需要先在各连接插件里登录（WorkBuddy 登录 / Trae 登录 / Qoder PAT）。本插件不保存任何凭证。
- 区域目前固定 `region=cn`；国际区账号（WorkBuddy global、Trae ai）会显示未登录。
- 仓库：<https://github.com/fzqfzqfzq/dsh-checkin-hub>

## 安装方式

### 方式一：从 GitHub Release 装（推荐，Windows / macOS / Linux 通用）

```bash
plugin_manager action=install_bundle target=https://github.com/fzqfzqfzq/dsh-checkin-hub/releases/download/v1.0.0/local-dsh-checkin-hub-1.0.0.tgz
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
plugin_manager action=install_bundle target=/绝对路径/local-dsh-checkin-hub-1.0.0.tgz

# Windows 示例（必须是绝对路径，反斜杠或正斜杠都可以）
plugin_manager action=install_bundle target=C:\Users\you\Downloads\local-dsh-checkin-hub-1.0.0.tgz

# 开发时直接指向源码目录（装出来是软链接，改源码即生效）
plugin_manager action=install_bundle target=/绝对路径/dsh-checkin-hub
```

安装后侧边栏出现「积分签到」图标（order 5），点击进入面板。

### 覆盖安装的坑

同一包名已经装过时，插件管理器会返回 `already-installed` 并保留原内容。换版本或换装法必须先移除：

```bash
plugin_manager action=remove_bundle target=@local/dsh-checkin-hub
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
git tag v1.0.1 && git push origin v1.0.1
```

`scripts/pack.mjs` 用 `node:fs` / `node:crypto` 直接算 SHA-256，不依赖 `shasum`、`sed` 这类只在类 Unix 上存在的命令；在 Windows 上通过 `shell: true` 调用 `npm.cmd`。

### 改名 / 发布到 npm

`package.json` 里的名字是 `@local/dsh-checkin-hub`，`@local` 不是可发布的 scope。要对外发布需要同时改两处：

1. `package.json` 的 `name` 改成自己的 scope（例如 `@yourname/dsh-checkin-hub`），并删掉 `"private": true`；
2. `cordis.patch.yml` 里 `- insert:` 的 `name` 必须与 `package.json` 的 `name` **完全一致**，否则安装后插件不会挂载。

改完 `npm publish --access public`，之后别人可以直接 `plugin_manager action=install_bundle target=@yourname/dsh-checkin-hub`。

## 结构

```
dsh-checkin-hub/
├── package.json           # dsh.bundle.patch + dsh.client（platform: web）
├── cordis.patch.yml       # - insert: [{ id: dsh-checkin-hub, ... }]
├── index.js               # Host 侧：仅声明挂载
├── client.js              # 侧边栏图标 + 主面板 UI（React，经 window.__ModuleLoader__ 加载）
├── locale/{en,zh}.json    # 插件元数据
├── icon.svg
├── scripts/pack.mjs       # 跨平台打包 + SHA-256
└── .github/workflows/release.yml   # 打 tag 自动构建 Release
```

界面文案通过 Client locale 服务注册（命名空间 `plugin.dsh-checkin-hub`，内置 zh/en 字典），样式仅使用 `--dsw-alias-*` 主题变量。

## 许可证

MIT，见 [LICENSE](LICENSE)。
