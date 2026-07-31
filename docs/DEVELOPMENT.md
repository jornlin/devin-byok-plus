# 开发指南

## 环境准备

```bash
git clone https://github.com/jornlin/devin-byok-plus.git
cd devin-byok-plus
pnpm install          # 或 npm install
```

需要能运行 `node --test` 的 Node 版本（18+）。目标宿主为 VS Code `^1.85.0`。

## 常用命令

```bash
npm run build         # 构建（esbuild bundle + Tailwind + 复制代理运行时）
npm run lint          # ESLint
npm run format        # Prettier
npm test              # 单元 + 集成测试
npm run package       # 打包 VSIX
```

生产模式构建（压缩、不带 sourcemap，模板启用缓存）：

```bash
NODE_ENV=production npm run build
```

测试直接用 Node 内置 runner：

```bash
node --test test/unit/*.test.mjs test/integration/*.test.mjs
```

## 项目结构

```
src/
├── extension.js        插件入口
├── managers/           代理进程启停、补丁管理、.env 读写
├── providers/          侧栏 WebView provider
├── services/           业务服务（方案存储、诊断、模型拉取、版本检查等）
├── utils/              工具函数
├── views/              HTML 模板、Tailwind 样式、渲染数据准备
└── proxy/              代理服务源码（ESM，独立于扩展宿主运行）
    ├── hybrid-server.js      聊天 / 搜索 / embeddings（:3006）
    ├── inference-proxy.js    代码补全（:3001）
    └── handlers/             按职责拆分的请求处理器

proxy-scripts/src/      [构建产物] 由 src/proxy/ 自动复制，勿直接编辑
resources/webviews/     侧栏客户端脚本与构建后的 CSS
test/                   单元与集成测试
scripts/                构建 / 打包 / 发布脚本
docs/                   文档
```

两点容易踩的：

- **`proxy-scripts/src/` 是构建产物**，被 gitignore。`npm run build` 会把
  `src/proxy/` 整棵树复制过去。改代码请改 `src/proxy/`。
- **`resources/webviews/sidebar.js` 是手工维护的** WebView 客户端脚本，
  不由构建生成。它无法 `require` 扩展侧模块，因此少量常量（如预设档位）
  在两边各有一份副本，测试里有一致性断言防止漂移。

## 构建流程

`npm run build` 依次做四件事：

1. Tailwind 编译 `src/views/styles/sidebar.css` → `resources/webviews/dist/sidebar.css`
2. esbuild 打包 `src/extension.js` → `dist/extension.js`（CommonJS，external: vscode）
3. 复制 `src/proxy/` → `proxy-scripts/src/`
4. 校验产物存在

## 架构要点

代理分两个进程，对应 Devin 的两类流量：

| 进程 | 端口 | 处理 |
| --- | --- | --- |
| `hybrid-server.js` | 3006 | 聊天、搜索、embeddings、模型清单接管 |
| `inference-proxy.js` | 3001 | 代码补全（HTTP/2） |

插件通过修改 Devin 的 `extension.js`（三处 URL 重定向补丁）把流量导到本地端口。
补丁前会备份为 `.devin-bak`，可一键还原。

槽位路由的关键链路：Devin 选中模型 → `model_uid` 写入 `GetChatMessage` 的
field 21 → `byok-slots.js` 的 `BYOK_SLOT_BY_REQUEST` 映射到槽位号 → 读取该槽位配置转发。

## 代码规范

- ESLint + Prettier，提交前跑 `npm run lint && npm run format`
- 代理层（`src/proxy/`）是 ESM，扩展层是 CommonJS，注意不要跨层 import
- 新增功能请补测试；协议相关改动务必加回归断言
  （例如字段语义、与 webview 侧副本的一致性）

## 相关文档

- [打包与安装](PACKAGING.md)
- [发布流程](RELEASE.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
