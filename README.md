# Devin BYOK Plus

用你自己的 API Key 在 [Devin Desktop](https://devin.ai/desktop/)（原 Windsurf）里跑
Claude / GPT / Gemini —— 4 个独立 BYOK 槽位、多方案切换、按厂商适配的思考强度控制。

> **非官方社区工具**，与 Devin Desktop、Cognition、Codeium 无隶属或授权关系。
> 仅设计用于本机运行（默认 `127.0.0.1`），不面向公网或多用户部署。
> 使用前请阅读 [免责声明](docs/DISCLAIMER.md)。

## 特性

- **4 个 BYOK 槽位** — 各自独立的网关、Key、模型、思考强度，可混用不同厂商
- **多方案管理** — 一套配置存为方案，随时切换
- **接管模型列表** — 把配置好的槽位放回 Devin 的模型下拉框，显示真实模型名
- **按厂商适配思考强度** — Claude adaptive / GPT `reasoning.effort` / Gemini `thinking_level`
- **协议自动识别** — 按模型名判断走 Anthropic / OpenAI / Gemini，也可手动指定
- **余额显示** — 状态栏显示 NewAPI / One-API / sub2api 余额（默认关闭，需配置访问令牌，刷新间隔可调）
- 导入 `~/.claude` / `~/.codex` 现有配置、Prompt Cache、Token 用量日志、请求重试

## 安装

在 Devin Desktop / VS Code 中：

1. `Ctrl+Shift+P` → **Extensions: Install Extension from Location...**
2. 克隆本仓库，选择仓库根目录

已打包的 VSIX 可用 **Install from VSIX...** 安装。
自行打包见 [打包指南](docs/PACKAGING.md)。

## 快速开始

1. 点击左侧 **Devin BYOK Plus** 图标打开控制面板
2. 在 **BYOK #1**（其余槽位可选）填写 Base URL 与 API Key
   —— 或点 **导入 Claude 配置** / **导入 GPT 配置** 读取本地已有配置
3. 点 **加载模型**，选一个模型
4. 点 **一键启动**
5. 在 **补丁管理** 安装补丁 → **重载窗口**

完成后在 Devin 的模型下拉框里就能看到你配置的模型。

配置字段会在输入后自动保存（650ms 防抖），无需手动点保存。

## 常用配置

在侧栏即可设置，完整列表见 [配置参考](docs/CONFIGURATION.md)。

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 最大 Token | `32768` | 单次输出上限。**设得过高会导致生成被截断** |
| 上下文窗口 | `200000` | 仅影响 Devin 界面显示的额度，不发往上游 |
| 模型列表模式 | `replace` | `replace` 只显示 BYOK 槽位 / `inject` 与官方模型共存 / `off` 不接管 |
| 默认使用 Cascade | 开启 | 避免新会话落到不经过本插件的 Devin Local |

## 文档

| 文档 | 内容 |
| --- | --- |
| [配置参考](docs/CONFIGURATION.md) | 全部环境变量、Token 与上下文、模型列表接管 |
| [模型与路由](docs/MODELS.md) | 4 槽位、协议识别、思考强度对照表 |
| [开发指南](docs/DEVELOPMENT.md) | 项目结构、构建流程、架构要点 |
| [打包指南](docs/PACKAGING.md) | 打包与安装 |
| [发布流程](docs/RELEASE.md) | 版本号与发布 |
| [贡献指南](docs/CONTRIBUTING.md) | 提交规范、请勿提交的内容 |
| [安全策略](docs/SECURITY.md) | 漏洞报告、敏感文件清单 |
| [免责声明](docs/DISCLAIMER.md) | 法律风险与合规提示 |
| [更新日志](CHANGELOG.md) | 版本变更记录 |

## 已知限制

- 仅在本机环回地址工作，不支持公网或多用户部署
- 依赖修改 Devin 客户端文件，**Devin 升级后需重新安装补丁**
- 模型清单接管依赖 Devin 内部协议字段，大版本更新后可能需要适配
- 「Devin Local」走独立 CLI，不经过本插件（故默认切换到 Cascade）

## 常见问题

**模型下拉框里没有我配的模型？**
确认代理已启动、补丁已安装并重载过窗口。若仍看不到，在「控制状态 → 代理日志」
查看是否有 `🔧 model list` 日志行。

**生成中途被截断、工具参数 JSON 不完整？**
大概率是 **最大 Token** 超过了模型经网关的实际输出上限，调回 32K 试试。
详见 [配置参考](docs/CONFIGURATION.md#最大-tokenmaxtokens)。

**Devin 升级后插件失效？**
重新安装补丁并重载窗口。补丁会被升级覆盖，这是预期行为。

**GPT 报 `/v1/responses` 相关错误？**
在「高级路由配置」把 OpenAI API Path 改为 `/v1/chat/completions`。

## 致谢

本项目 fork 自 [ycx932436/devin-byok-bridge](https://github.com/ycx932436/devin-byok-bridge)，
感谢原作者 [@ycx932436](https://github.com/ycx932436) 开创了 Devin Desktop BYOK
本地代理的先河。本仓库在其基础上扩展了 4 槽位、方案系统、模型清单接管等功能，
完整变更见 [CHANGELOG](CHANGELOG.md)。

## 交流

使用问题、Bug 反馈、功能建议都欢迎。Bug 与需求建议优先走
[Issues](https://github.com/jornlin/devin-byok-plus/issues)（便于追踪），
日常交流可加 Telegram 群。

<div align="center">
  <a href="https://t.me/devin_byok_plus">
    <img src="resources/images/telegram-qr.png" alt="Telegram 群组 @devin_byok_plus" width="200">
  </a>
  <p>
    <a href="https://t.me/devin_byok_plus"><strong>Telegram 群组</strong></a> ·
    <code>@devin_byok_plus</code>
  </p>
</div>

## 许可

[MIT](LICENSE.txt)

---

<div align="center">
  <a href="https://linux.do" target="_blank">
    <img src="https://cdn3.ldstatic.com/original/4X/c/c/d/ccd8c210609d498cbeb3d5201d4c259348447562.png" alt="LinuxDo" height="48">
  </a>
  <p>作者活跃于 <a href="https://linux.do" target="_blank"><strong>LinuxDo</strong></a> · @jorn_lin</p>
</div>
