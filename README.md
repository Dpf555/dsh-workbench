# DSH Workbench — VS Code 风格三栏布局插件

参考 [microsoft/vscode](https://github.com/microsoft/vscode) 的设计，为 DeepSeek Harness（DSH）Web GUI 增加：

- **右侧常驻 Explorer 文件树**（VS Code 官方 seti 文件类型图标、展开/折叠、新建文件/文件夹、刷新、全部折叠、可拖宽/折叠面板）
- **中间区域点击文件即切换为代码编辑器**（monaco-editor 0.52.2 —— VS Code 编辑器核心；多标签页、语法高亮、minimap、Ctrl+S、脏标记、保存冲突"重新加载/强制覆盖"）
- **编辑器占满整列**（编辑时下方输入框/停靠条自动隐藏，"返回会话"或顶部"对话"标签切回）
- **安全边界**：所有文件操作经 DSH 的 `ctx.fs` 服务，双重围栏在工作区沙箱内，越界拒绝；写入走版本号 CAS 防覆盖

```
┌─────────┬──────────────────────────┬────────────┐
│ 左侧边栏 │  中间：会话 ⇄ 文件内容     │ 右侧：文件树 │
│ （不变） │  点文件 → Monaco 编辑器    │ Explorer   │
└─────────┴──────────────────────────┴────────────┘
```

## 架构

| 文件 | 作用 |
|---|---|
| `index.js` | 主机半部（Cordis 插件）：注册 `/wb/*` 静态资源路由 + `/wb/api/<op>` 文件操作（describe/listDir/readFile/writeFile/createFile/createDir/assetText），工作区围栏 |
| `client.js` | 客户端半部（浏览器插件 bundle）：引导加载 `/wb/workbench-client.js` |
| `assets/workbench-client.js` | UI bundle：右栏 ExplorerRoot（`explorer` slot）+ 中栏 EditorView（`conversation.view` 的 `workbench.editor` 视图） |
| `assets/vs/` | monaco-editor 发行版（`npm run setup:assets` 生成，不入库） |
| `assets/seti.*` | seti 图标字体与生成产物（`npm run generate:seti`） |
| `patches/*.patch` | 对 DSH 检出包的三处内嵌补丁（三栏布局依赖它们） |
| `scripts/*.mjs` | 资产下载/图标生成/补丁应用/profile 安装 |
| `dynamic/` | 会话内动态插件形态（cordis_define 用），可选 |

三处补丁（`patches/`，对 DSH `0.1.0-rc.6` 生成）：

1. `ui-layout.patch` — AppFrame 新增第 4 条网格轨道 `explorer`（240–420px、默认 300）+ `explorer` slot + 拖宽手柄 + `toggleExplorer` 服务方法
2. `ui-conversation.patch` — 暴露 `window.__DSH_CONV_BRIDGE__[sessionId].setView`，点击文件自动切换中间视图
3. `ui-sidebar.patch` — 页面加载即挂载 UI bundle（刷新自愈）

## 安装

前置：Node.js ≥ 18、git、可访问 npm registry 的网络。

```bash
git clone <this-repo> dsh-workbench
cd dsh-workbench

# 1. 下载 monaco 资产并生成 seti 图标（约 13MB）
npm run setup:assets

# 2. 安装到 DSH profile（下次 `dsh web` 重启后随组合加载 /wb 路由与客户端引导）
node scripts/install-profile.mjs --profile web

# 3. 给当前 DSH 检出打三栏布局补丁（不改则只有浮窗/无右栏，见下方"补丁"说明）
node scripts/apply-patches.mjs --checkout <checkout-root>
# 不传 --checkout 时自动探测 ~/.npm-cache/_npx 下的检出
```

然后**重启 `dsh web`** 并 **Ctrl+F5 硬刷新**页面。

> 检出根目录：包含 `node_modules/@deepseek-ai/` 的目录（npx 安装通常位于
> `~/.npm-cache/_npx/<hash>/`；本机示例 `C:\Users\<you>\.npm-cache\_npx\1e7f6d9597241db0`）。

## 补丁（为什么需要）

DSH 的客户端壳不提供"常驻右栏 + 点击文件切换中间视图"的公开扩展点：

- 右栏需要布局壳新增网格轨道（`explorer` slot）——由 `ui-layout.patch` 完成
- 中间视图环（`conversation.view`）的活动视图切换是私有状态——由 `ui-conversation.patch` 暴露桥接

补丁直接修改检出的客户端 bundle（DSH 按请求实时读取、`cache-control: no-cache`，硬刷新即生效，无需构建）。补丁基于 `0.1.0-rc.6` 生成；DSH 升级后如不能应用，请对照新 bundle 重新生成（`git diff --no-index <原始> <补丁后>`）。

## 使用

1. 硬刷新页面 → 右栏出现文件树
2. 点目录展开、点文件 → 中间自动切换为 Monaco 编辑器，输入框隐藏
3. Ctrl+S 保存；顶部"对话 / 代码"标签或"返回会话"按钮切换
4. 右栏头部：新建文件/文件夹、刷新、全部折叠、`«` 收起面板；左边缘拖宽；**收起后右侧保留 28px 窄条，点击即可重新展开**

## 卸载

1. 删除 `<DSH_HOME>/profiles/web/cordis.patch.yml` 中 `- insert:` 的 `workbench` 行，重启 `dsh web`
2. 删除 `<DSH_HOME>/profiles/web/node_modules/@dsh-local/dsh-workbench/`
3. 补丁回退：重装对应 npm 包（`npm i @deepseek-ai/dsh-client-ui-{layout,conversation,sidebar}@0.1.0-rc.6` 后覆盖检出的 `lib/client.js`），或 `git apply -R patches/*.patch`

## 已知限制

- `ctx.fs` 契约无 rename/delete → 暂不支持重命名/删除文件
- 二进制文件只读拒绝；单文件读取上限 5MB
- 未打开会话时右栏可见但点击文件不切换中间视图（视图环是会话级的）
- 文件树根 = 部署沙箱工作区根（`sandboxPolicy` fallback root）

## 致谢与许可

- [microsoft/vscode](https://github.com/microsoft/vscode)（Explorer 设计参考；seti 图标与主题数据，MIT）
- [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor)（MIT）
- [jesseweed/seti-ui](https://github.com/jesseweed/seti-ui)（seti 字体上游，MIT）
- 本插件 MIT License
