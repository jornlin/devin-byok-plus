# 配置参考

所有配置项都可以在侧栏控制面板里设置，插件会写入 `proxy-scripts/.env`（或用户配置目录）。
本文档列出全部环境变量，供需要手工编辑或排查问题时查阅。

- 侧栏「配置连接」Tab：BYOK 槽位、协议、模型、思考强度、高级路由
- 侧栏「控制状态」Tab：端口、模型接管模式、默认 Cascade

配置字段在输入后会自动保存（650ms 防抖），无需手动点保存。

## 目录

- [BYOK 槽位（#1–#4）](#byok-槽位14)
- [通用](#通用)
- [最大 Token（`MAX_TOKENS`）](#最大-tokenmaxtokens)
- [上下文窗口（`CONTEXT_WINDOW`）](#上下文窗口contextwindow)
- [模型列表接管（`MODEL_LIST_MODE`）](#模型列表接管modellistmode)
- [默认使用 Cascade](#默认使用-cascade)
- [可选环境变量](#可选环境变量)
- [Prompt Cache / Token 优化](#prompt-cache--token-优化)
- [上游地址覆盖](#上游地址覆盖)

## BYOK 槽位（#1–#4）

四套配置完全独立，可分别指向不同网关、不同 Key、不同模型。`n` 取 `1`–`4`：

```
BYOK{n}_ANTHROPIC_API_HOST=      # 网关域名，留空用 api.anthropic.com
BYOK{n}_ANTHROPIC_API_KEY=
BYOK{n}_ANTHROPIC_API_PATH=      # 默认 /v1/messages
BYOK{n}_OPENAI_API_HOST=         # 留空则复用 ANTHROPIC_API_HOST
BYOK{n}_OPENAI_API_KEY=          # 留空则复用 ANTHROPIC_API_KEY
BYOK{n}_OPENAI_API_PATH=         # 默认 /v1/responses
BYOK{n}_OPENAI_SERVICE_TIER=     # priority / fast，空=不写该字段
BYOK{n}_OPENAI_REASONING_MODE=   # standard / pro，仅 gpt-5.6* 生效
BYOK{n}_MODEL=                   # 实际请求的模型名
BYOK{n}_THINKING_EFFORT=         # 见 MODELS.md 的思考强度表
BYOK{n}_PROTOCOL=                # anthropic / openai / gemini，空=按模型名自动识别
```

### 兼容字段（镜像 BYOK #1）

供旧版本与部分回退路径读取，由插件自动写入，一般无需手动维护：

```
ANTHROPIC_API_HOST / ANTHROPIC_API_KEY / ANTHROPIC_API_PATH
OPENAI_API_HOST / OPENAI_API_KEY / OPENAI_API_PATH
OPENAI_SERVICE_TIER / OPENAI_REASONING_MODE
OPENAI_REASONING_EFFORT / OPENAI_THINKING_ENABLED
DEFAULT_MODEL
```

## 通用

```
HYBRID_PORT=3006               # 聊天 / 搜索 / embeddings
INFERENCE_PORT=3001            # 代码补全
MAX_TOKENS=32768               # 单次输出上限（发往上游 API）
CONTEXT_WINDOW=200000          # 上下文窗口（仅影响 Devin 界面显示）
MODEL_LIST_MODE=replace        # 模型列表接管：replace / inject / off
COMPLETION_TIMEOUT_MS=12000
SYSTEM_PROMPT_OVERRIDE=
SYSTEM_PROMPT_PATH=
ADMIN_TOKEN=                   # 可选；设置后 /api/config POST 需 Bearer 鉴权
PROXY_DEVICE_ID=               # 由扩展注入子进程
PROXY_CLIENT_VERSION=
```

## 最大 Token（`MAX_TOKENS`）

对应 API 请求体的 `max_tokens`，即**单次回复的输出上限**，不是上下文窗口。
主流模型的输出上限在 8K–128K 量级，远小于其 200K–1M 的上下文窗口。

> **设得过高会导致生成被确定性截断** —— 表现为工具参数 JSON 不完整、SSE 中途断流、
> 重试同一请求无效。默认取 32768（推荐值）。

侧栏「配置连接 → 高级路由配置 → 最大 Token」提供
4K / 8K / 16K / 32K（推荐）/ 64K / 128K 六档预设，也可选「自定义…」填写任意值；
超过 64K 时会给出提示。

## 上下文窗口（`CONTEXT_WINDOW`）

**与 `MAX_TOKENS` 是两个独立概念。** 它只影响 Devin 界面显示的上下文额度，
不发往上游 API：

- 模型卡片上的 `200K context`
- 对话框底部上下文进度条的分母（用量百分比）

技术上它写入 `ClientModelConfig.max_tokens`（field 18）。该字段虽名为 max_tokens，
但 Devin 的语义是**上下文窗口** —— 真正的输出上限在 `ModelInfo.max_output_tokens`
（f13）。同名不同义，容易取错。

侧栏提供 128K / 200K（推荐）/ 256K / 512K / 1M 五档预设，也可自定义。
取值按厂商宣传的十进制口径（200K = 200000）。

## 模型列表接管（`MODEL_LIST_MODE`）

Devin 的模型下拉列表由服务端下发。自某次更新起，服务端不再下发
`MODEL_CLAUDE_4_*_BYOK` 这四个条目，导致 BYOK 槽位在 UI 上无法选中
（转发能力本身完好，属于「入口消失」）。代理会改写清单把已配置的槽位放回下拉框：

| 值 | 行为 | 适用 |
| --- | --- | --- |
| `replace`（默认） | 只显示 BYOK 槽位，展示干净的模型名（如 `Claude Opus 4.8`） | 多数场景；列表清爽、所见即所得 |
| `inject` | 保留官方模型，追加 BYOK 槽位 | Pro 账号，官方额度与自有 key 共存 |
| `off` | 不接管，原样放行上游清单 | 排障 / 一键退回 |

在侧栏「控制状态 → 模型接管 → 模型列表模式」切换，即时生效（无需重启代理）；
Devin 侧重新打开模型下拉框即可看到变化。任何解析异常都会回落为原样放行。

### 下拉框里的信息

```
Claude Opus 4.8                    ← label，由你配置的模型名生成
输出上限 32K · claude-opus-4-8      ← description(f27)，副标题行
BYOK · 200K context                ← 元信息行，context 来自 f18
```

上下文由 Devin 原生渲染，而输出上限**没有**对应的原生展示字段
（`ModelInfo.max_output_tokens` 不在 UI 的字段映射里），故写入 `description`
让它作为副标题显示。替换模式下副标题会附上真实模型名，便于确认实际请求的模型。

## 默认使用 Cascade

Devin 新建会话默认选中「Devin Local」，而该模式走 ACP 协议与独立的 `devin` CLI，
**不经过本插件代理**，其模型列表里没有 BYOK 条目（显示 `None selected`），
需手动切到 Cascade 才能使用。

侧栏「控制状态 → 模型接管 → 默认使用 Cascade」开关（默认开启）会把 Devin 自身的
`acp.preferredAgent` 设为 Cascade 哨兵值 `__cascade__`，使新建会话默认用 Cascade。
修改的是 Devin 的用户设置（非本插件 `.env`），**需重载窗口生效**。

若你已手动指定了其他 agent（如 `claude-code`），插件不会覆盖该选择。

## 可选环境变量

需手动写入 `.env`：

| 变量 | 说明 |
| --- | --- |
| `OPENAI_ENABLE_REASONING=false` | 关闭 GPT reasoning |
| `GATEWAY_CAPABILITY_TTL_MS=3600000` | 网关能力缓存 TTL；记住某网关是否优先走 Chat Completions |
| `GATEWAY_CAPABILITY_CACHE_PATH=` | 网关能力缓存落盘路径（跨进程 / 重启复用）；由扩展自动注入，一般无需设置 |
| `TOOL_ALLOWLIST=` / `TOOL_DENYLIST=` | 转发工具白 / 黑名单（逗号或空格分隔，支持 `mcp1_*` 前缀通配），`deny` 优先于 `allow`；亦支持 `BYOK_TOOL_*` 前缀别名 |
| `TOOL_ALLOW_PREFIXES=` / `TOOL_DENY_PREFIXES=` | 按前缀过滤转发工具（等价于名单项以 `*` 结尾） |
| `STRIP_UNSIGNED_THINKING=false` | 保留无 signature 的 Claude thinking 块（默认剔除，建议保持默认） |
| `ALLOW_UNAUTH_CONFIG_POST=true` | 允许非 localhost 无鉴权修改运行时配置（**不推荐**） |
| `VOYAGE_API_KEY=` | Embeddings 走 Voyage 时需要 |
| `PROXY_SESSION_SECRET=` | 可选；用于上游请求签名，见 [SECURITY.md](SECURITY.md) |

## Prompt Cache / Token 优化

默认开启，流结束时输出 `📊` 用量日志（可在侧栏「控制状态 → 代理日志」查看）。

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PROMPT_CACHE_ENABLED` | `true` | 总开关，`false` 时停用全部 cache 优化 |
| `ANTHROPIC_PROMPT_CACHE` | `true` | Claude 请求打 `cache_control` 断点（网关不支持时自动降级重试） |
| `OPENAI_PROMPT_CACHE` | `observe` | GPT / Gemini 前缀缓存模式：`observe` / `auto` / `off` |
| `PROMPT_CACHE_SORT_TOOLS` | `true` | tools 按 name 稳定排序，稳定请求前缀 |
| `PROMPT_CACHE_TAIL_MESSAGES` | `2` | cache 断点距消息尾部的偏移条数 |
| `EXPOSE_BACKEND_INFO` | `false` | 是否在 system prompt 末尾追加 backend 信息（开启会破坏前缀缓存） |

## 上游地址覆盖

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PROXY_API_HOST` | `server.self-serve.windsurf.com` | hybrid-server 上游 API 地址 |
| `PROXY_INFERENCE_HOST` | `inference.codeium.com` | inference-proxy 上游地址 |
