# Windsurf BYOK Bridge

> **非官方社区工具** — 与 Windsurf / Codeium 无隶属或授权关系。使用前请阅读 [DISCLAIMER.md](DISCLAIMER.md)、[SECURITY.md](SECURITY.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。

Windsurf IDE BYOK 桥接插件 — 使用自己的 API Key 连接 Claude / GPT / Gemini 模型。

**设计定位：** 仅在本机运行（默认 `127.0.0.1`），代理与配置由用户自行管理，**不面向公网或多用户部署**。

- 插件 ID：`windsurf-byok-bridge`
- 显示名：Windsurf BYOK Bridge
- 维护者 / Publisher：`ycx932436`
- 版本：1.0.0
- 仓库：https://github.com/ycx932436/windsurf-byok-bridge

## 安装

在 Windsurf / VS Code 中：

1. `Ctrl+Shift+P` → **Extensions: Install Extension from Location...**
2. 克隆或下载本仓库，选择仓库根目录（`windsurf-byok-bridge/`）

若已打包 VSIX，也可使用 **Install from VSIX...**（请使用本仓库构建的 VSIX，**勿**将含本地配置的 VSIX 提交到 Git）。

## 快速开始

1. 点击左侧 **Windsurf BYOK Bridge** 图标打开控制面板
2. 在 **BYOK #1** 和 **BYOK #2** 分别填写 Base URL（可选）、API Key
3. 各自点击 **加载模型**，选择模型；Claude / GPT / Gemini 会显示对应厂商的思考强度选项
4. 点击 **一键启动**
5. 在 **补丁管理** 中安装补丁，然后 **重载窗口**

## 双 BYOK 配置

两套代理完全独立，可指向不同网关、不同 Key、不同模型。

| 槽位 | Windsurf 中选择 | 用途 |
|------|-----------------|------|
| **BYOK #1** | `Claude Opus 4 BYOK` | 主代理槽位 |
| **BYOK #2** | `Claude Opus 4 Thinking BYOK` | 第二代理槽位（常用于思考模型） |

在侧栏选什么模型，Windsurf 走对应槽位时就用那个模型（Claude 或 GPT 均可）。

## 思考强度

切换模型后，下拉选项会**按厂商自动变化**（标签也会更新）：

| 厂商 | 标签示例 | 后端映射 |
|------|----------|----------|
| **Claude** | `Claude · adaptive / budget_tokens` | adaptive + effort，或 `budget_tokens` |
| **GPT** | `GPT · reasoning.effort` | `reasoning.effort` |
| **Gemini** | `Gemini 3.5 Flash · thinking_level` | `thinking_config.thinking_level` |

每个 BYOK 槽位可单独设置：

| 档位 | 值 | Claude | GPT | Gemini（3.5 Flash 标准） |
|------|-----|--------|-----|--------------------------|
| 默认/关闭 | （空） | 不启用思考 | 不启用 reasoning | 不覆盖，API 默认 `medium` |
| Minimal | `minimal` | — | — | 最低思考 / 最低延迟 |
| 低 | `low` | budget 5k / adaptive | `reasoning.effort=low` | `thinking_level=low` |
| 中 | `medium` | budget 10k / adaptive | `reasoning.effort=medium` | `thinking_level=medium`（默认） |
| 高 | `high` | budget 20k / adaptive | `reasoning.effort=high` | `thinking_level=high` |
| 极高 | `xhigh` | budget 32k / adaptive | `reasoning.effort=xhigh` | 映射为 `high` |
| Max | `max` | adaptive `effort=max` | — | 映射为 `high` |

说明：

- **Claude 新模型**（如 `claude-opus-4-8`、`claude-opus-4-7`、`claude-opus-4-6`、`claude-sonnet-4-6`）使用 `thinking: { type: "adaptive" }` + `output_config.effort`
- **Claude 旧模型** 使用 `thinking: { type: "enabled", budget_tokens: N }`
- **GPT** 走 OpenAI Responses API（`/v1/responses`），通过 `reasoning.effort` 控制
- **Gemini 3.x**（以 **3.5 Flash** 为准）使用 `thinking_config.thinking_level`（`minimal` / `low` / `medium` / `high`），**不要**与 `thinking_budget` 同传
- **Gemini 2.5** 等旧模型仍回退为 `thinking_budget` 数值映射
- BYOK #2 在未选强度时，默认按 **中** 启用思考

## 模型路由

| 上游类型 | 识别规则 | API 路径（默认） |
|----------|----------|------------------|
| Claude | `claude-*` / `MODEL_CLAUDE*` | `/v1/messages` |
| GPT | `gpt-*` / `MODEL_GPT*` | `/v1/responses` |
| Gemini | `gemini-*` / `MODEL_GOOGLE_GEMINI*` | `/v1/responses`（OpenAI 兼容） |

聊天请求按 Windsurf 所选 BYOK 槽位，读取对应槽位的 Host / Key / 模型 / 思考强度。

## 目录结构

```
windsurf-byok-bridge/
├── package.json
├── extension.js              # 扩展入口
├── integrity.js              # 设备 ID / 版本
├── sidebarProvider.js        # 侧栏 Webview + HTML 模板
├── proxyManager.js           # 代理进程 / .env 管理
├── patchManager.js           # Windsurf 补丁
├── reloadWorkbench.js
├── README.md
├── SECURITY.md
├── LICENSE.txt
├── media/
│   ├── icon.svg
│   └── sidebar.js            # 侧栏前端逻辑
└── proxy-scripts/              # 本地代理（Node ESM）
    ├── package.json
    ├── prompts/system-prompt.md
    └── src/
        ├── hybrid-server.js    # 聊天 / 搜索 / embeddings（:3006）
        ├── inference-proxy.js  # 代码补全（:3001）
        ├── connect.js / proto.js / net-utils.js / ws-bridge.js
        └── handlers/
            ├── byok-slots.js   # 双 BYOK 槽位路由
            ├── models.js       # 运行时配置
            ├── chat.js         # 聊天 + 思考强度
            ├── completions.js  # 补全（BYOK #1 Anthropic）
            ├── anthropic-stream.js / openai-stream.js
            └── …               # parse-request, embeddings, web-search 等
```

## 环境变量

由插件写入 `proxy-scripts/.env`（该文件已被 `.gitignore` 排除）。手动配置时可参考模板：[proxy-scripts/.env.example](proxy-scripts/.env.example)。

### BYOK #1

```
BYOK1_ANTHROPIC_API_HOST=
BYOK1_ANTHROPIC_API_KEY=
BYOK1_OPENAI_API_HOST=
BYOK1_OPENAI_API_KEY=
BYOK1_MODEL=
BYOK1_THINKING_EFFORT=        # low | medium | high | xhigh | max
```

### BYOK #2

```
BYOK2_ANTHROPIC_API_HOST=
BYOK2_ANTHROPIC_API_KEY=
BYOK2_OPENAI_API_HOST=
BYOK2_OPENAI_API_KEY=
BYOK2_MODEL=
BYOK2_THINKING_EFFORT=
```

### 兼容 / 补全（镜像 BYOK #1）

```
ANTHROPIC_API_HOST=
ANTHROPIC_API_KEY=
OPENAI_API_HOST=
OPENAI_API_KEY=
DEFAULT_MODEL=
OPENAI_REASONING_EFFORT=      # 镜像 BYOK1_THINKING_EFFORT
OPENAI_THINKING_ENABLED=
```

### 通用

```
HYBRID_PORT=3006
INFERENCE_PORT=3001
MAX_TOKENS=16384
COMPLETION_TIMEOUT_MS=12000
SYSTEM_PROMPT_OVERRIDE=
SYSTEM_PROMPT_PATH=
PROXY_DEVICE_ID=              # 由扩展注入子进程
PROXY_CLIENT_VERSION=
ADMIN_TOKEN=                  # 可选；设置后 /api/config POST 需 Bearer 鉴权
```

可选环境变量（手动写入 `.env`）：

- `OPENAI_ENABLE_REASONING=false` — 关闭 GPT reasoning
- `ALLOW_UNAUTH_CONFIG_POST=true` — 允许非 localhost 无鉴权修改运行时配置（**不推荐**）
- `VOYAGE_API_KEY=` — Embeddings 走 Voyage 时需要
- `PROXY_SESSION_SECRET=` — 可选；用于上游请求签名（见 [SECURITY.md](SECURITY.md)）

## 已知限制

- **代码补全 (Completions)** 仅走 Anthropic 通道，使用 BYOK #1 镜像配置；暂不支持 GPT 补全
- **GPT** 无独立 Windsurf BYOK 入口，需在 BYOK 槽位中选择 GPT 模型
- 网关需支持对应 API：Claude `/v1/messages`，GPT `/v1/responses`

## 常见问题

**补丁失效**：Windsurf 更新后重新「安装补丁」并「重载窗口」。

**端口占用**：修改 Hybrid/Inference 端口后重新启动代理。

**启动失败**：检查 Node.js、API Key、侧栏日志。

**模型列表加载失败**：检查 Key、余额、网络；确认网关兼容。

**思考无效果**：确认思考强度未选「关闭」；Claude 新模型需网关支持 adaptive thinking。

## 开源与贡献

- 完整法律说明见 **[DISCLAIMER.md](DISCLAIMER.md)**（补丁、MITM、商标、责任限制等）
- 贡献与「请勿提交的文件」见 **[CONTRIBUTING.md](CONTRIBUTING.md)**
- 部分代码经**故意混淆**，属项目既定策略，用于限制非本地场景的随意复用；MIT 许可不变，详见 DISCLAIMER

### 克隆 / Fork 后请勿提交

| 类型 | 示例 |
|------|------|
| 本地配置 | `proxy-scripts/.env` |
| MITM 证书 | `proxy-scripts/certs/` |
| 打包产物 | `*.vsix` |
| 调试捕获 | `**/captures/**`、`proxy-scripts/debug/` |

## 法律风险与免责声明

> **请在安装或使用前完整阅读本节。** 完整版见 **[DISCLAIMER.md](DISCLAIMER.md)**。本项目按「现状」提供，作者与贡献者不对任何直接或间接损失承担责任。

### 非官方项目

- 本项目为**社区开源工具**，由 [`ycx932436`](https://github.com/ycx932436) 维护。
- **与 Windsurf、Codeium、Exafunction 及其关联方无任何隶属、授权或背书关系。**
- 名称中的 “Windsurf” 仅用于说明兼容目标，**不代表官方产品或扩展**。
- 安全问题请通过 [GitHub Security Advisories](https://github.com/ycx932436/windsurf-byok-bridge/security/advisories) 或 [Issues](https://github.com/ycx932436/windsurf-byok-bridge/issues) 报告，详见 [SECURITY.md](SECURITY.md)。

### 服务条款与合规

- 使用本工具可能涉及对 Windsurf 客户端的修改与 API 流量重定向，**可能违反 Windsurf / Codeium 用户协议或服务条款**。
- 你应自行确认：所在地区法律、雇主政策、以及 Windsurf 与上游模型提供商（Anthropic、OpenAI、Google 等）的使用政策是否允许此类用法。
- **禁止**将本工具用于绕过付费订阅、滥用配额、批量爬取或任何违法用途。
- 你对通过本工具发起的全部 API 请求、费用与内容负责。

### 补丁机制风险

- 「安装补丁」会**直接修改** Windsurf 内置 `extension.js`（并可能更新 `product.json` 校验和）。
- Windsurf 升级后补丁可能失效或产生冲突；错误操作可能导致 IDE AI 功能异常。
- 安装前请备份原文件（扩展会自动创建 `.windsurf-bak`，但仍建议手动备份）。
- 还原补丁后通常需重载或重启 Windsurf。

### 本地代理与 MITM

- 本工具在本地启动 HTTP 服务（默认 `:3006` / `:3001`），将 Windsurf 的 AI 请求转发至你配置的 API 网关。
- 可选 **MITM 模式**会拦截发往 Windsurf 云端的 HTTPS 连接；仅在**你拥有且可控的环境**中使用。
- MITM 相关证书**不得**提交到 Git 或公开分享；`.gitignore` 已排除 `proxy-scripts/certs/`。
- 在不可信网络或共享机器上启用 MITM 可能导致中间人攻击风险。

### 数据与隐私

- API Key 与 `.env` 配置**仅保存在本机**，由你自行保管。
- **切勿**将 `.env`、API Key、MITM 私钥或诊断报告中的敏感信息提交到 GitHub 或粘贴到公开 Issue。
- 诊断报告功能会脱敏部分字段，但仍可能包含路径、端口、进程信息；分享前请复核。
- `PROXY_DEVICE_ID` 为本地生成的设备标识，用于子进程关联，**不会**由本仓库代码主动上传至外部服务器。
- 本地代理默认监听 `127.0.0.1`；**请勿**将 Hybrid/Inference 端口暴露到公网或不可信网络（见 [SECURITY.md](SECURITY.md)）。

### 开源许可

- 本项目代码以 [MIT License](LICENSE.txt) 发布。
- Windsurf、Codeium 及相关商标归各自权利人所有；本仓库不授予任何第三方商标使用权。

### 责任限制

**在法律允许的最大范围内**，作者与贡献者对因使用或无法使用本软件导致的任何损害（包括但不限于数据丢失、服务中断、API 超额计费、IDE 损坏、违反第三方条款导致的账号限制）**不承担任何责任**。使用本软件即表示你已理解并接受上述风险。

更多条款（设计定位、源码混淆、商标与 IP）见 **[DISCLAIMER.md](DISCLAIMER.md)**。
