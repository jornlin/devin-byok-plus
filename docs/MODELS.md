# 模型、路由与思考强度

## 4 个 BYOK 槽位

四套代理完全独立，可分别指向不同网关、不同 Key、不同模型。
BYOK #3 / #4 为可选扩展槽位，不强制配置。

| 槽位 | 内部标识（`model_uid`） | 典型用途 |
| --- | --- | --- |
| **BYOK #1** | `MODEL_CLAUDE_4_OPUS_BYOK` | 主力槽位 |
| **BYOK #2** | `MODEL_CLAUDE_4_OPUS_THINKING_BYOK` | 思考模型 |
| **BYOK #3** | `MODEL_CLAUDE_4_SONNET_BYOK` | 高性价比槽位 |
| **BYOK #4** | `MODEL_CLAUDE_4_SONNET_THINKING_BYOK` | 备用 / 另一厂商 |

> **下拉框里显示什么名字？**
> 自 v2.4 起插件会接管模型清单，条目名**由你配置的模型名生成**（如 `Claude Opus 4.8`），
> 不再是固定的 `Claude Opus 4 BYOK`。`model_uid` 沿用原枚举名只是为了让槽位路由生效。
> 详见 [CONFIGURATION.md 的模型列表接管](CONFIGURATION.md#模型列表接管modellistmode)。

每个槽位可独立选择厂商、模型、思考强度、手动协议与 OpenAI Processing Tier。

## 模型路由

| 上游类型 | 识别规则 | API 路径（默认） |
| --- | --- | --- |
| Claude | `claude-*` / `MODEL_CLAUDE*` | `/v1/messages` |
| GPT | `gpt-*` / `MODEL_GPT*` | `/v1/responses`，失败后回退 `/v1/chat/completions` |
| Gemini | `gemini-*` / `MODEL_GOOGLE_GEMINI*` | `/v1/responses`，失败后回退 `/v1/chat/completions`（OpenAI 兼容） |

聊天请求按 Devin 所选槽位，读取对应槽位的 Host / Key / 模型 / 思考强度。

协议识别可以手动覆盖：在侧栏槽位卡片的 **API 协议** 下拉选择
`anthropic` / `openai` / `gemini`，留空则按模型名自动识别。

若网关明确只支持传统 Chat Completions，可在 **高级路由配置** 中把
OpenAI API Path 改为 `/v1/chat/completions`，避免先探测 `/v1/responses`。
代理会缓存网关能力，减少重复的 500。

DeepSeek / Kimi 等使用非标准 Anthropic 路径（`/anthropic`）的网关会被自动修正；
若你手动改过路径，则以你的设置为准。

## 思考强度

切换模型后，下拉选项会**按厂商自动变化**（标签也会更新）：

| 厂商 | 标签示例 | 后端映射 |
| --- | --- | --- |
| Claude | `Claude · adaptive / budget_tokens` | adaptive + effort，或 `budget_tokens` |
| GPT | `GPT · reasoning.effort` | `reasoning.effort` |
| GPT-5.6 | `GPT · reasoning.effort` | `reasoning.effort`（保留 `max`）+ 可选 `reasoning.mode` |
| Gemini | `Gemini 3.5 Flash · thinking_level` | `thinking_config.thinking_level` |

各档位的实际取值：

| 档位 | 值 | Claude | GPT | Gemini（3.5 Flash 标准） |
| --- | --- | --- | --- | --- |
| 默认 / 关闭 | （空） | 不启用思考 | 不启用 reasoning | 不覆盖，API 默认 `medium` |
| Minimal | `minimal` | — | — | 最低思考 / 最低延迟 |
| 低 | `low` | budget 5k / adaptive | `reasoning.effort=low` | `thinking_level=low` |
| 中 | `medium` | budget 10k / adaptive | `reasoning.effort=medium` | `thinking_level=medium`（默认） |
| 高 | `high` | budget 20k / adaptive | `reasoning.effort=high` | `thinking_level=high` |
| 极高 | `xhigh` | budget 32k / adaptive | `reasoning.effort=xhigh` | 映射为 `high` |
| Max | `max` | adaptive `effort=max` | 仅 `gpt-5.6*` 用 `max`，其他 GPT 降为 `xhigh` | 映射为 `high` |

### 细节说明

- **Claude 新模型**（`claude-opus-4-8` / `4-7` / `4-6`、`claude-sonnet-4-6` 等）
  使用 `thinking: { type: "adaptive" }` + `output_config.effort`
- **Claude 旧模型** 使用 `thinking: { type: "enabled", budget_tokens: N }`
- **GPT** 默认走 Responses API（`/v1/responses`），通过 `reasoning.effort` 控制；
  网关不支持时自动回退 `/v1/chat/completions`
- **GPT-5.6**（模型名以 `gpt-5.6` 开头）额外支持 `reasoning.mode`
  （`standard` / `pro`），仅写入 Responses API（Chat Completions 回退不携带）
- **Gemini 3.x**（以 3.5 Flash 为准）使用 `thinking_config.thinking_level`，
  **不要**与 `thinking_budget` 同传
- **Gemini Chat Completions 回退** 会尽力传递 `thinking_config`；
  网关不支持该扩展字段时再降级为不带 thinking 的请求
- **Gemini 2.5** 等旧模型仍回退为 `thinking_budget` 数值映射
- **BYOK #2** 在未选强度时，默认按 **中** 启用思考
- **Bedrock / Claude thinking**：多轮历史中若存在无 `signature` 的 thinking 块，
  代理默认剔除以避免 `signature: Field required`；
  需保留可设 `STRIP_UNSIGNED_THINKING=false`

## OpenAI Processing Tier

OpenAI 模型可在槽位卡片里设置 **GPT Processing Tier**：

| 选项 | 写入字段 | 说明 |
| --- | --- | --- |
| （空） | 不写 | 默认 |
| Priority | `service_tier=priority` | OpenAI 官方优先处理 |
| Fast | `service_tier=fast` | 兼容部分网关的快速模式 |
