# Devin BYOK Plus

> **非官方社区工具** — 与 Devin Desktop（原 Windsurf）、Codeium / Cognition 无隶属或授权关系。使用前请阅读 [DISCLAIMER.md](docs/DISCLAIMER.md)、[SECURITY.md](docs/SECURITY.md) 与 [CONTRIBUTING.md](docs/CONTRIBUTING.md)。

Devin Desktop BYOK 增强版 — 多模型路由、4 个 BYOK 槽位、手动协议选择、思考强度控制、GPT-5.6 推理模式、OpenAI Processing Tier（priority/fast）、状态栏余额显示，使用自己的 API Key 连接 Claude / GPT / Gemini 模型。

> **更名说明：** 2026 年 6 月起 Windsurf 已更名为 [Devin Desktop](https://devin.ai/desktop/)。本项目同步更名为 **Devin BYOK Plus**，并保留对旧版 Windsurf 安装路径的兼容。

## 致谢

**本项目 fork 自 [ycx932436/devin-byok-bridge](https://github.com/ycx932436/devin-byok-bridge)，在原作者出色工作的基础上进行功能扩展与持续维护。**

衷心感谢原作者 [@ycx932436](https://github.com/ycx932436) 打下的坚实基础，开创了 Devin Desktop BYOK 本地代理的先河。本仓库在原有基础上的增强包括：

- 4 槽位 BYOK 扩展（新增 Claude Sonnet 4 BYOK #3 / #4）
- 多渠道 Profile 方案系统
- 手动协议选择（anthropic / openai / gemini）
- GPT-5.6 推理模式（`reasoning.mode` = standard / pro）与 OpenAI Processing Tier（`service_tier` = priority / fast）
- 转发工具过滤（allow / deny 名单 + 前缀通配）
- 网关能力缓存磁盘持久化（跨进程 / 重启复用）
- 状态栏 API 余额显示（NewAPI / One-API）与 GitHub 版本更新提示
- DeepSeek / Kimi Anthropic 路径自动修正
- Prompt Cache / Token 用量日志
- 请求重试与熔断机制
- 持续的 bug 修复与文档完善

**再次向原作者致敬，感谢开源精神！**

**设计定位：** 仅在本机运行（默认 `127.0.0.1`），代理与配置由用户自行管理，**不面向公网或多用户部署**。

- 插件 ID：`devin-byok-plus`
- 显示名：Devin BYOK Plus
- 维护者 / Publisher：`jornlin`
- 版本：2.4.0
- 仓库：https://github.com/jornlin/devin-byok-plus

## 安装

在 Devin Desktop / VS Code 中：

1. `Ctrl+Shift+P` → **Extensions: Install Extension from Location...**
2. 克隆或下载本仓库，选择仓库根目录（`devin-byok-plus/`）

若已打包 VSIX，也可使用 **Install from VSIX...**（请使用本仓库构建的 VSIX，**勿**将含本地配置的 VSIX 提交到 Git）。

## 快速开始

1. 点击左侧 **Devin BYOK Plus** 图标打开控制面板
2. 在 **BYOK #1 至 #4** （任选）分别填写 Base URL（可选）、API Key，或点击 **导入 Claude 配置** / **导入 GPT 配置** 读取 `~/.claude` / `~/.codex` 用户配置
3. （可选）从 **Protocol** 下拉手动选择 anthropic / openai / gemini，空值时自动按模型名识别
4. 各自点击 **加载模型**，选择模型；导入配置会自动保存并尝试加载模型；Claude / GPT / Gemini 会显示对应厂商的思考强度选项
5. （可选）OpenAI 模型可将 **GPT Processing Tier** 设为 `Priority · service_tier=priority`（OpenAI 官方优先处理）或 `Fast · service_tier=fast`（兼容网关快速模式）
6. （可选）**GPT-5.6 系列**模型会额外出现 **推理模式** 下拉，可设为 `standard` / `pro`（写入 Responses API 的 `reasoning.mode`）
7. 点击 **一键启动**
8. 在 **补丁管理** 中安装补丁，然后 **重载窗口**

> **💡 自动保存提示**：配置字段（API Key、模型、端口、协议、Processing Tier、推理模式等）会在输入后自动保存（650ms 防抖），无需手动点击"保存配置"按钮。显式保存仍会显示成功提示。

> **💰 余额显示**：为方案填写 `balanceToken`（访问令牌）或 `userId` 后，状态栏会显示当前激活方案的 API 余额（NewAPI / One-API），每 2 分钟自动刷新、切换方案时刷新、可点击手动刷新。未配置的用户不会发起任何余额查询请求。

## 4 BYOK 配置

四套代理完全独立，可分别指向不同网关、不同 Key、不同模型。BYOK #3 / #4 为可选扩展槽位，不强制配置。

| 槽位 | Devin Desktop 中选择 | 用途 |
|------|----------------------|------|
| **BYOK #1** | `Claude Opus 4 BYOK` | 主代理槽位（Opus） |
| **BYOK #2** | `Claude Opus 4 Thinking BYOK` | Opus 思考模型 |
| **BYOK #3** | `Claude Sonnet 4 BYOK` | Sonnet 高性价比槽位 |
| **BYOK #4** | `Claude Sonnet 4 Thinking BYOK` | Sonnet 思考模型 |

在侧栏选什么模型，Devin Desktop 走对应槽位时就用那个模型（Claude / GPT / Gemini 均可）。每个槽位可独立选择厂商、模型、思考强度、手动协议以及 OpenAI Fast Mode。

## 思考强度

切换模型后，下拉选项会**按厂商自动变化**（标签也会更新）：

| 厂商 | 标签示例 | 后端映射 |
|------|----------|----------|
| **Claude** | `Claude · adaptive / budget_tokens` | adaptive + effort，或 `budget_tokens` |
| **GPT** | `GPT · reasoning.effort` | `reasoning.effort` |
| **GPT-5.6** | `GPT · reasoning.effort` | `reasoning.effort`（保留 `max`）+ 可选 `reasoning.mode` |
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
| Max | `max` | adaptive `effort=max` | 仅 `gpt-5.6*` 使用 `reasoning.effort=max`；其他 GPT 映射为 `xhigh` | 映射为 `high` |

说明：

- **Claude 新模型**（如 `claude-opus-4-8`、`claude-opus-4-7`、`claude-opus-4-6`、`claude-sonnet-4-6`）使用 `thinking: { type: "adaptive" }` + `output_config.effort`
- **Claude 旧模型** 使用 `thinking: { type: "enabled", budget_tokens: N }`
- **GPT** 默认走 OpenAI Responses API（`/v1/responses`），通过 `reasoning.effort` 控制；网关不支持时会自动回退到 `/v1/chat/completions`
- **GPT-5.6**（模型名以 `gpt-5.6` 开头）额外支持 `reasoning.mode`（`standard` / `pro`），仅写入 Responses API（Chat Completions 回退不携带）；且保留 `max` 思考强度（其他 GPT 的 `max` 仍降级为 `xhigh`）
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
├── src/
│   ├── extension.js           # 插件入口
│   ├── managers/              # 代理进程 / 补丁管理
│   │   ├── proxyManager.js         # 代理启停、.env 写入、运行时热重载
│   │   ├── patchManager.js
│   │   ├── proxy-config.js
│   │   ├── proxy-paths.js
│   │   └── proxy-process.js
│   ├── providers/             # 侧栏 WebView
│   │   ├── sidebarProvider.js
│   │   └── sidebar-utils.js
│   ├── services/              # 业务服务（Provider 模块化拆分）
│   │   ├── diagnostics.js              # 环境与路由诊断（含 service_tier）
│   │   ├── environmentProbe.js
│   │   ├── externalConfigImporter.js   # 读取 ~/.claude / ~/.codex
│   │   ├── modelFetcher.js
│   │   ├── profileStore.js             # 多方案存储（~/.devin-byok-plus/profiles.json，含 balanceToken/userId）
│   │   ├── promptTemplates.js
│   │   ├── thinkingEffort.js           # 思考强度选项（含 GPT-5.6 gpt56 组）
│   │   └── versionChecker.js           # GitHub Releases 版本更新检测
│   ├── utils/                 # 工具函数
│   │   ├── gatewayUrl.js               # 网关 URL 协议推断
│   │   ├── integrity.js                # 设备 ID / 版本
│   │   └── reloadWorkbench.js
│   ├── views/                 # 视图模板与样式
│   │   ├── sidebarHtml.js
│   │   ├── sidebarTemplate.js          # 渲染数据准备（含 protocol / serviceTier options）
│   │   ├── styles/sidebar.css          # Tailwind CSS 源文件
│   │   └── templates/                  # HTML partials（config-tab / control-tab / system-tab / tutorial）
│   └── proxy/                 # 代理服务源码（构建后复制到 proxy-scripts/src/）
│       ├── hybrid-server.js            # 聊天 / 搜索 / embeddings（:3006）
│       ├── inference-proxy.js          # 代码补全（:3001）
│       ├── connect.js / proto.js / net-utils.js / ws-bridge.js / retry-utils.js
│       ├── prompts/system-prompt.md
│       └── handlers/
│           ├── byok-slots.js               # 4 槽位 BYOK 路由 + protocol 白名单 + reasoning effort 映射
│           ├── models.js                   # 运行时配置（含 service_tier / reasoning_mode）
│           ├── chat.js                     # 聊天 + 思考强度 + service_tier/reasoning.mode 注入 + 工具过滤 + SSE 帧拆分
│           ├── gateway-capability.js       # 网关能力缓存（支持磁盘持久化）
│           ├── openai-request.js           # OpenAI 路径与回退转换
│           ├── completions.js              # 补全（BYOK #1 Anthropic）
│           ├── prompt-cache.js             # Prompt Cache 断点与降级重试
│           ├── usage-log.js                # Token 用量统一日志
│           ├── anthropic-stream.js / openai-stream.js
│           └── …                           # parse-request, embeddings, web-search 等
├── proxy-scripts/             # 代理运行时目录
│   ├── package.json
│   ├── prompts/
│   └── src/                        # [构建产物] 从 src/proxy/ 自动复制
├── resources/                 # 图标等静态资源 + webviews/sidebar.js
├── test/                      # 单元测试
└── scripts/                   # 构建 / 打包 / 发布脚本
```

## 环境变量

由插件写入 `proxy-scripts/.env`（该文件已被 `.gitignore` 排除）。手动配置时可参考模板：[proxy-scripts/.env.example](proxy-scripts/.env.example)。

### BYOK #1 至 #4

每个槽位（n = 1..4）均支持相同字段：

```
BYOKn_ANTHROPIC_API_HOST=
BYOKn_ANTHROPIC_API_KEY=
BYOKn_ANTHROPIC_API_PATH=/v1/messages
BYOKn_OPENAI_API_HOST=
BYOKn_OPENAI_API_KEY=
BYOKn_OPENAI_API_PATH=/v1/responses
BYOKn_OPENAI_SERVICE_TIER=    # priority | fast | 空；priority=OpenAI 官方优先，fast=兼容网关快速模式
BYOKn_OPENAI_REASONING_MODE= # standard | pro | 空；仅 gpt-5.6* 生效，写入 Responses API 的 reasoning.mode
BYOKn_MODEL=
BYOKn_THINKING_EFFORT=        # low | medium | high | xhigh | max（max 仅 gpt-5.6* 保留，其他 GPT 降级 xhigh）
BYOKn_PROTOCOL=               # anthropic | openai | gemini | 空（自动识别）
```

> `.env.example` 仅列出 BYOK #1 / #2 作为参考；BYOK #3 / #4 采用完全相同的前缀命名方式手动补充即可。

### 兼容 / 补全（镜像 BYOK #1）

```
ANTHROPIC_API_HOST=
ANTHROPIC_API_KEY=
OPENAI_API_HOST=
OPENAI_API_KEY=
OPENAI_SERVICE_TIER=          # 镜像 BYOK1_OPENAI_SERVICE_TIER
OPENAI_REASONING_MODE=        # 镜像 BYOK1_OPENAI_REASONING_MODE
DEFAULT_MODEL=
OPENAI_REASONING_EFFORT=      # 镜像 BYOK1_THINKING_EFFORT
OPENAI_THINKING_ENABLED=
```

### 通用

```
HYBRID_PORT=3006
INFERENCE_PORT=3001
MAX_TOKENS=64000
COMPLETION_TIMEOUT_MS=12000
MODEL_LIST_MODE=inject        # 模型列表接管：inject / replace / off
SYSTEM_PROMPT_OVERRIDE=
SYSTEM_PROMPT_PATH=
PROXY_DEVICE_ID=              # 由扩展注入子进程
PROXY_CLIENT_VERSION=
ADMIN_TOKEN=                  # 可选；设置后 /api/config POST 需 Bearer 鉴权
```

### 模型列表接管（`MODEL_LIST_MODE`）

Devin 的模型下拉列表由服务端下发。自某次更新起，服务端不再下发
`MODEL_CLAUDE_4_*_BYOK` 这四个条目，导致本插件的槽位在 UI 上无法选中
（转发能力本身完好，属于「入口消失」）。代理会改写清单把已配置的槽位放回下拉框：

| 值 | 行为 | 适用 |
| --- | --- | --- |
| `inject`（默认） | 保留官方模型，追加 BYOK 槽位 | Pro 账号，官方额度与自有 key 共存 |
| `replace` | 只显示 BYOK 槽位，并展示干净的模型名（如 `Claude Opus 4.8`） | 非 Pro 账号；列表清爽 |
| `off` | 不接管，原样放行上游清单 | 排障 / 一键退回 |

在侧栏「控制状态 → 代理控制 → 模型列表模式」切换，即时生效（无需重启代理）；
Devin 侧重新打开模型下拉框即可看到变化。任何解析异常都会回落为原样放行。

### 默认使用 Cascade

Devin 新建会话默认选中「Devin Local」，而该模式走 ACP 协议与独立的 `devin` CLI，
**不经过本插件代理**，其模型列表里没有 BYOK 条目（显示 `None selected`），
需手动切到 Cascade 才能使用。

侧栏「控制状态 → 代理控制 → 默认 Cascade」开关（默认开启）会把 Devin 自身的
`acp.preferredAgent` 设为 Cascade 哨兵值 `__cascade__`，使新建会话默认用 Cascade。
修改的是 Devin 的用户设置（非本插件 `.env`），**需重载窗口生效**。
若你已手动指定了其他 agent（如 `claude-code`），插件不会覆盖该选择。

可选环境变量（手动写入 `.env`）：

- `OPENAI_ENABLE_REASONING=false` — 关闭 GPT reasoning
- `GATEWAY_CAPABILITY_TTL_MS=3600000` — 网关能力缓存 TTL；用于记住某网关是否优先走 Chat Completions
- `GATEWAY_CAPABILITY_CACHE_PATH=` — 网关能力缓存落盘路径（跨进程 / 重启复用）；由扩展自动注入至用户配置目录（`gateway-capability-cache.json`），一般无需手动设置
- `TOOL_ALLOWLIST=` / `TOOL_DENYLIST=` — 转发工具白 / 黑名单（逗号 / 空格分隔，支持 `mcp1_*` 前缀通配），`deny` 优先于 `allow`；亦支持 `BYOK_TOOL_*` 前缀别名
- `TOOL_ALLOW_PREFIXES=` / `TOOL_DENY_PREFIXES=mcp3_` — 按前缀过滤转发工具（等价于名单项以 `*` 结尾）
- `STRIP_UNSIGNED_THINKING=false` — 保留无 signature 的 Claude thinking 块（默认剔除，建议保持默认）
- `ALLOW_UNAUTH_CONFIG_POST=true` — 允许非 localhost 无鉴权修改运行时配置（**不推荐**）
- `VOYAGE_API_KEY=` — Embeddings 走 Voyage 时需要
- `PROXY_SESSION_SECRET=` — 可选；用于上游请求签名（见 [SECURITY.md](docs/SECURITY.md)）

Prompt Cache / Token 优化（默认开启，流结束输出 `📊` 用量日志）：

- `PROMPT_CACHE_ENABLED=true` — 总开关，`false` 时停用全部 cache 优化
- `ANTHROPIC_PROMPT_CACHE=true` — Claude 请求打 `cache_control` 断点（网关不支持时自动降级重试）
- `OPENAI_PROMPT_CACHE=observe` — GPT/Gemini 前缀缓存模式：`observe`（默认）/ `auto` / `off`
- `PROMPT_CACHE_SORT_TOOLS=true` — tools 按 name 稳定排序，稳定请求前缀
- `PROMPT_CACHE_TAIL_MESSAGES=2` — cache 断点距消息尾部的偏移条数
- `EXPOSE_BACKEND_INFO=false` — 是否在 system prompt 末尾追加 backend 信息（开启会破坏前缀缓存）

上游代理地址覆盖：

- `PROXY_API_HOST=` — hybrid-server 上游 API 地址（默认 `server.self-serve.windsurf.com`）
- `PROXY_INFERENCE_HOST=` — inference-proxy 上游地址（默认 `inference.codeium.com`）

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

- 完整法律说明见 **[DISCLAIMER.md](docs/DISCLAIMER.md)**（补丁、MITM、商标、责任限制等）
- 贡献与「请勿提交的文件」见 **[CONTRIBUTING.md](docs/CONTRIBUTING.md)**

### 克隆 / Fork 后请勿提交

| 类型 | 示例 |
|------|------|
| 本地配置 | `proxy-scripts/.env` |
| MITM 证书 | `proxy-scripts/certs/` |
| 打包产物 | `*.vsix` |
| 调试捕获 | `**/captures/**`、`proxy-scripts/debug/` |

## 法律风险与免责声明

> **请在安装或使用前完整阅读本节。** 完整版见 **[DISCLAIMER.md](docs/DISCLAIMER.md)**。本项目按「现状」提供，作者与贡献者不对任何直接或间接损失承担责任。

### 非官方项目

- 本项目为**社区开源工具**，由 [`jornlin`](https://github.com/jornlin) 维护。
- **与 Devin Desktop、Cognition、Codeium、Exafunction 及其关联方无任何隶属、授权或背书关系。**
- 名称中的 “Devin””Windsurf” 等字样**仅用于说明兼容目标或历史名称**，不代表官方产品或扩展。
- 安全问题请通过 [GitHub Security Advisories](https://github.com/jornlin/devin-byok-plus/security/advisories) 或 [Issues](https://github.com/jornlin/devin-byok-plus/issues) 报告，详见 [SECURITY.md](docs/SECURITY.md)。

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
- 本地代理默认监听 `127.0.0.1`；**请勿**将 Hybrid/Inference 端口暴露到公网或不可信网络（见 [SECURITY.md](docs/SECURITY.md)）。

### 开源许可

- 本项目代码以 [MIT License](LICENSE.txt) 发布。
- Devin、Windsurf、Codeium、Cognition 及相关商标归各自权利人所有；本仓库不授予任何第三方商标使用权。

### 责任限制

**在法律允许的最大范围内**，作者与贡献者对因使用或无法使用本软件导致的任何损害（包括但不限于数据丢失、服务中断、API 超额计费、IDE 损坏、违反第三方条款导致的账号限制）**不承担任何责任**。使用本软件即表示你已理解并接受上述风险。

更多条款（设计定位、商标与 IP）见 **[DISCLAIMER.md](docs/DISCLAIMER.md)**。

## 📦 开发者打包指南

### 快速打包

```bash
# 使用 npm 脚本
npm run package

# 或使用 Shell 脚本
./package.sh
```

### 打包输出

成功后会生成 `devin-byok-plus-{version}.vsix` 文件。

### 安装方法

1. **通过 VS Code GUI**：扩展面板 → 右上角 `...` → 从 VSIX 安装
2. **通过命令行**：`code --install-extension devin-byok-plus-2.4.0.vsix`
3. **拖拽安装**：直接拖拽 `.vsix` 到 VS Code 窗口

详细打包说明请查看 [PACKAGING.md](./docs/PACKAGING.md)。

## 👨‍💻 开发者指南

### 项目结构

本项目采用标准的 VS Code 插件目录结构，代码按功能模块化组织：

完整目录结构见上文 [目录结构](#目录结构) 章节。

### 环境准备

```bash
# 克隆仓库
git clone https://github.com/jornlin/devin-byok-plus.git
cd devin-byok-plus

# 安装依赖（推荐使用 pnpm）
pnpm install
```

### 开发命令

```bash
# 构建项目（开发模式，带 sourcemap）
pnpm run build

# 构建项目（生产模式，压缩）
NODE_ENV=production pnpm run build

# 代码检查
pnpm run lint

# 代码格式化
pnpm run format

# 运行测试
pnpm test

# 打包插件
pnpm run package
```

### 构建流程

`pnpm run build`（即 `node scripts/build.js`）依次执行：

1. **编译 Tailwind CSS**：`src/views/styles/sidebar.css` → `resources/webviews/dist/sidebar.css`（压缩）
2. **打包扩展**：esbuild 将 `src/extension.js` 打包为 `dist/extension.js`（CJS，`external: vscode`）
3. **同步代理运行时**：将 `src/proxy/` 复制到 `proxy-scripts/src/`（VSIX 中代理实际运行的目录）

> 注意：`package.json` 的 `main` 指向 `./src/extension.js`，VSIX 打包时保留 `src/**/*.js`（见 `.vscodeignore`），扩展在安装后直接从 `src/` 运行；`dist/extension.js` 为 esbuild 产物，便于调试与体积分析。

`pnpm run package`（即 `node scripts/package.js`）会先执行上述构建，再调用 `vsce package`，最终将 `.vsix` 移动到 `build/` 目录。

### 代码规范

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 提交前请确保代码通过 lint 检查

### 贡献指南

欢迎提交 PR 和 Issue！详细指南请查看 [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)。

### CI/CD

项目配置了 GitHub Actions 自动化流程：

- **代码检查**：自动运行 ESLint
- **构建测试**：验证构建是否成功
- **单元测试**：运行测试用例
- **自动打包**：main 分支推送时自动生成 VSIX

## 🔗 LinuxDo 社区

<div align="center">
  <a href="https://linux.do" target="_blank">
    <img src="https://cdn3.ldstatic.com/original/4X/c/c/d/ccd8c210609d498cbeb3d5201d4c259348447562.png" alt="LinuxDo" height="60">
  </a>
  <p>
    <a href="https://linux.do" target="_blank"><strong>LinuxDo 社区</strong></a><br>
  </p>
    <p>@jorn_lin</p>
    <p>本人长期活跃于L站;</p>
    <p>这里的人很好说话又好听;</p>
    <p>欢迎都来加入L站大家庭。 </p>

</div>


