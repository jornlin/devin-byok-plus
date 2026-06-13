# Devin BYOK Plus

> **非官方社区工具** — 与 Devin Desktop（原 Windsurf）、Codeium / Cognition 无隶属或授权关系。使用前请阅读 [DISCLAIMER.md](DISCLAIMER.md)、[SECURITY.md](SECURITY.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。

Devin Desktop BYOK 增强版 — 多模型路由、双槽位、思考强度控制，使用自己的 API Key 连接 Claude / GPT / Gemini 模型。

> **更名说明：** 2026 年 6 月起 Windsurf 已更名为 [Devin Desktop](https://devin.ai/desktop/)。本项目同步更名为 **Devin BYOK Plus**，并保留对旧版 Windsurf 安装路径的兼容。

## 致谢

**本项目 fork 自 [ycx932436/devin-byok-bridge](https://github.com/ycx932436/devin-byok-bridge)，在原作者出色工作的基础上进行功能扩展与持续维护。**

衷心感谢原作者 [@ycx932436](https://github.com/ycx932436) 打下的坚实基础，开创了 Devin Desktop BYOK 本地代理的先河。本仓库在原有基础上的增强包括：

- 请求重试与熔断机制
- 持续的 bug 修复与文档完善

**再次向原作者致敬，感谢开源精神！**

**设计定位：** 仅在本机运行（默认 `127.0.0.1`），代理与配置由用户自行管理，**不面向公网或多用户部署**。

- 插件 ID：`devin-byok-plus`
- 显示名：Devin BYOK Plus
- 维护者 / Publisher：`jornlin`
- 版本：2.0.2
- 仓库：https://github.com/jornlin/devin-byok-plus

## 安装

在 Devin Desktop / VS Code 中：

1. `Ctrl+Shift+P` → **Extensions: Install Extension from Location...**
2. 克隆或下载本仓库，选择仓库根目录（`devin-byok-plus/`）

若已打包 VSIX，也可使用 **Install from VSIX...**（请使用本仓库构建的 VSIX，**勿**将含本地配置的 VSIX 提交到 Git）。

## 快速开始

1. 点击左侧 **Devin BYOK Plus** 图标打开控制面板
2. 在 **BYOK #1** 和 **BYOK #2** 分别填写 Base URL（可选）、API Key，或点击 **导入 Claude 配置** / **导入 GPT 配置** 读取 `~/.claude` / `~/.codex` 用户配置
3. 各自点击 **加载模型**，选择模型；导入配置会自动保存并尝试加载模型；Claude / GPT / Gemini 会显示对应厂商的思考强度选项
4. 点击 **一键启动**
5. 在 **补丁管理** 中安装补丁，然后 **重载窗口**

## 双 BYOK 配置

两套代理完全独立，可指向不同网关、不同 Key、不同模型。

| 槽位 | Devin Desktop 中选择 | 用途 |
|------|----------------------|------|
| **BYOK #1** | `Claude Opus 4 BYOK` | 主代理槽位 |
| **BYOK #2** | `Claude Opus 4 Thinking BYOK` | 第二代理槽位（常用于思考模型） |

在侧栏选什么模型，Devin Desktop 走对应槽位时就用那个模型（Claude 或 GPT 均可）。

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
- **GPT** 默认走 OpenAI Responses API（`/v1/responses`），通过 `reasoning.effort` 控制；网关不支持时会自动回退到 `/v1/chat/completions`
- **Gemini 3.x**（以 **3.5 Flash** 为准）使用 `thinking_config.thinking_level`（`minimal` / `low` / `medium` / `high`），**不要**与 `thinking_budget` 同传
- **Gemini Chat Completions 回退** 会尽力传递 `thinking_config`；若网关不支持该扩展字段，会再降级为不带 thinking 的 Chat Completions
- **Gemini 2.5** 等旧模型仍回退为 `thinking_budget` 数值映射
- BYOK #2 在未选强度时，默认按 **中** 启用思考
- **Bedrock / Claude thinking** 多轮历史中若存在无 `signature` 的 thinking 块，代理默认会剔除以避免 `signature: Field required`；如需保留可手动设置 `STRIP_UNSIGNED_THINKING=false`

## 模型路由

| 上游类型 | 识别规则 | API 路径（默认） |
|----------|----------|------------------|
| Claude | `claude-*` / `MODEL_CLAUDE*` | `/v1/messages` |
| GPT | `gpt-*` / `MODEL_GPT*` | `/v1/responses`，失败后回退 `/v1/chat/completions` |
| Gemini | `gemini-*` / `MODEL_GOOGLE_GEMINI*` | `/v1/responses`，失败后回退 `/v1/chat/completions`（OpenAI 兼容） |

聊天请求按 Devin Desktop 所选 BYOK 槽位，读取对应槽位的 Host / Key / 模型 / 思考强度。

若网关明确只支持传统 Chat Completions，可在侧栏 **高级路由** 中将 OpenAI API Path 改为 `/v1/chat/completions`，避免先探测 `/v1/responses`。代理会按网关能力缓存短期记忆回退结果，减少重复 500。

## 目录结构

```
devin-byok-plus/
├── package.json
├── extension.js              # 扩展入口
├── integrity.js              # 设备 ID / 版本
├── sidebarProvider.js        # 侧栏 Webview + HTML 模板
├── sidebarHtml.js            # 侧栏 HTML 工具函数
├── gatewayUrl.js             # 网关 URL 协议推断
├── externalConfigImporter.js # 读取 ~/.claude / ~/.codex 用户配置
├── proxyManager.js           # 代理进程 / .env 管理
├── patchManager.js           # Devin Desktop 补丁（兼容 Windsurf 路径）
├── reloadWorkbench.js
├── README.md
├── SECURITY.md
├── LICENSE.txt
├── test/
│   └── bridge.test.mjs       # 核心逻辑单元测试
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
            ├── gateway-capability.js # 网关能力缓存
            ├── openai-request.js     # OpenAI 路径与回退转换
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
- `GATEWAY_CAPABILITY_TTL_MS=3600000` — 网关能力缓存 TTL；用于记住某网关是否优先走 Chat Completions
- `STRIP_UNSIGNED_THINKING=false` — 保留无 signature 的 Claude thinking 块（默认剔除，建议保持默认）
- `ALLOW_UNAUTH_CONFIG_POST=true` — 允许非 localhost 无鉴权修改运行时配置（**不推荐**）
- `VOYAGE_API_KEY=` — Embeddings 走 Voyage 时需要
- `PROXY_SESSION_SECRET=` — 可选；用于上游请求签名（见 [SECURITY.md](SECURITY.md)）

## 已知限制

- **代码补全 (Completions)** 仅走 Anthropic 通道，使用 BYOK #1 镜像配置；暂不支持 GPT 补全
- **GPT** 无独立 Devin BYOK 入口，需在 BYOK 槽位中选择 GPT 模型
- 网关需支持对应 API：Claude `/v1/messages`；GPT/Gemini 优先 `/v1/responses`，不支持时回退 `/v1/chat/completions`
- 上游 API 域名在过渡期内仍可能使用 `*.windsurf.com` / `*.codeium.com`（见 [Devin Desktop FAQ](https://docs.devin.ai/desktop/devin-desktop-faq)）

## 常见问题

**补丁失效**：Devin Desktop 更新后重新「安装补丁」并「重载窗口」。

**端口占用**：修改 Hybrid/Inference 端口后重新启动代理。

**启动失败**：检查 Node.js、API Key、侧栏日志。

**模型列表加载失败**：检查 Key、余额、网络；确认网关兼容。

**思考无效果**：确认思考强度未选「关闭」；Claude 新模型需网关支持 adaptive thinking。

**Bedrock 报 `signature: Field required`**：通常是历史消息里有无签名 thinking。默认代理会剔除无签名 thinking；仍失败时请新开对话或关闭 BYOK #2 思考强度。

**GPT 报 `convert_request_failed` / `not implemented`**：通常是网关不支持 `/v1/responses`。代理会自动回退 `/v1/chat/completions`；若仍失败，请在高级路由中手动设置 OpenAI API Path。

**从旧版迁移**：插件 ID 已从 `windsurf-byok-bridge` / `devin-byok-bridge` 改为 `devin-byok-plus`；本地配置会自动迁移，补丁备份优先使用 `.devin-bak`，仍兼容 `.windsurf-bak`。

## 开源与贡献

- 完整法律说明见 **[DISCLAIMER.md](DISCLAIMER.md)**（补丁、MITM、商标、责任限制等）
- 贡献与「请勿提交的文件」见 **[CONTRIBUTING.md](CONTRIBUTING.md)**

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

- 本项目为**社区开源工具**，由 [`jornlin`](https://github.com/jornlin) 维护。
- **与 Devin Desktop、Cognition、Codeium、Exafunction 及其关联方无任何隶属、授权或背书关系。**
- 名称中的 “Devin””Windsurf” 等字样**仅用于说明兼容目标或历史名称**，不代表官方产品或扩展。
- 安全问题请通过 [GitHub Security Advisories](https://github.com/jornlin/devin-byok-plus/security/advisories) 或 [Issues](https://github.com/jornlin/devin-byok-plus/issues) 报告，详见 [SECURITY.md](SECURITY.md)。

### 服务条款与合规

- 使用本工具可能涉及对 Devin Desktop 客户端的修改与 API 流量重定向，**可能违反 Devin / Codeium 用户协议或服务条款**。
- 你应自行确认：所在地区法律、雇主政策、以及 Devin 与上游模型提供商（Anthropic、OpenAI、Google 等）的使用政策是否允许此类用法。
- **禁止**将本工具用于绕过付费订阅、滥用配额、批量爬取或任何违法用途。
- 你对通过本工具发起的全部 API 请求、费用与内容负责。

### 补丁机制风险

- 「安装补丁」会**直接修改** Devin Desktop 内置 `extension.js`（并可能更新 `product.json` 校验和）。
- IDE 升级后补丁可能失效或产生冲突；错误操作可能导致 AI 功能异常。
- 安装前请备份原文件（扩展会自动创建 `.devin-bak`，仍兼容 `.windsurf-bak`）。
- 还原补丁后通常需重载或重启 Devin Desktop。

### 本地代理与 MITM

- 本工具在本地启动 HTTP 服务（默认 `:3006` / `:3001`），将 Devin Desktop 的 AI 请求转发至你配置的 API 网关。
- 可选 **MITM 模式**会拦截发往 Codeium / Windsurf 云端域名的 HTTPS 连接；仅在**你拥有且可控的环境**中使用。
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
- Devin、Windsurf、Codeium、Cognition 及相关商标归各自权利人所有；本仓库不授予任何第三方商标使用权。

### 责任限制

**在法律允许的最大范围内**，作者与贡献者对因使用或无法使用本软件导致的任何损害（包括但不限于数据丢失、服务中断、API 超额计费、IDE 损坏、违反第三方条款导致的账号限制）**不承担任何责任**。使用本软件即表示你已理解并接受上述风险。

更多条款（设计定位、商标与 IP）见 **[DISCLAIMER.md](DISCLAIMER.md)**。
