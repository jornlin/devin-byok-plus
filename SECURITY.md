# Security Policy

## Design Scope

本工具**按本地单机、默认 `127.0.0.1` 绑定**设计。在此预期用法下：

- API Key 与 `.env` 由用户在本机保管；
- 配置与代理接口面向本机进程，**不**作为面向公网的服务交付。

若用户自行将端口暴露到公网、修改 `BIND_HOST` 或启用非 localhost 访问，相关风险**不在**本项目的默认安全模型内。完整法律说明见 [DISCLAIMER.md](DISCLAIMER.md)。

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

仅最新发布版本会收到安全修复。本项目尚未建立固定发布节奏；请使用仓库 `main` 分支最新代码。

## Reporting a Vulnerability

**请勿在公开 Issue 中粘贴 API Key、`.env` 内容、MITM 私钥或完整诊断报告。**

推荐方式（按优先级）：

1. [GitHub Security Advisories — Private vulnerability report](https://github.com/ycx932436/windsurf-byok-bridge/security/advisories/new)
2. 若无法使用 Advisory，可开 Issue 并**仅描述复现步骤与影响**，附件中的日志须先脱敏

我们会在合理时间内确认收到报告。由于本项目为社区维护、无 SLA，修复时间取决于严重程度与维护者可用性。

## Out of Scope

以下通常**不属于**本仓库的安全漏洞，请勿作为 CVE 报告：

- 用户自行配置的 API Key 泄露（例如提交 `.env` 到 Git）
- 在**违背本地单机设计**的场景下暴露 `:3006` / `:3001`（如绑定公网、端口转发）导致的未授权访问
- 违反 Windsurf / Codeium 服务条款或使用补丁修改客户端本身（见 [DISCLAIMER.md](DISCLAIMER.md)）
- 上游模型网关（Anthropic、OpenAI、Google 等）的缺陷
- 要求公开完整去混淆源码或逐行审计混淆实现本身

## User Security Guidelines

### API Key 与配置文件

- `proxy-scripts/.env` 含敏感信息，**不得**提交到 Git（已在 `.gitignore` 中排除）
- 侧栏填写的 Key 会写入上述 `.env`；共享机器或多用户环境请谨慎使用

### 本地代理端口

- 默认绑定 `127.0.0.1`（`HYBRID_PORT=3006`、`INFERENCE_PORT=3001`）
- **不要**将端口转发到公网或 `0.0.0.0`，除非明确理解风险并已配置防护
- 若必须从非 localhost 访问配置接口，请设置 `ADMIN_TOKEN`，且**不要**启用 `ALLOW_UNAUTH_CONFIG_POST=true`

### MITM 证书

- 可选 MITM 模式需要 `proxy-scripts/certs/` 下的证书与私钥
- 证书目录已在 `.gitignore` 中排除；**切勿**上传私钥或分享给他人
- 仅在可信的本机环境使用 MITM

### 补丁与 Windsurf 文件

- 「安装补丁」会修改 Windsurf 安装目录内的 `extension.js`，并创建 `.windsurf-bak` 备份
- 还原补丁前请确认备份完整；Windsurf 大版本升级后请重新评估补丁兼容性

### 诊断报告

- 侧栏「维护工具」可导出诊断报告，已对 Key 等字段做部分脱敏
- 报告仍可能包含本机路径、端口、进程命令行；公开分享前请人工复核

## Sensitive Files Checklist

以下内容**永远不应**出现在 Git 仓库或公开 Issue 中：

| 文件 / 内容 | 说明 |
|-------------|------|
| `proxy-scripts/.env` | API Key、Host 配置 |
| `proxy-scripts/certs/*.pem` | MITM 证书与私钥 |
| `*.vsix`（含内嵌 `.env` 时） | 打包产物可能携带本地配置 |
| 完整诊断报告 | 可能含路径与进程信息 |
| `_deob_test/` | 本地测试目录，勿提交 |

环境变量占位模板（可提交）：[proxy-scripts/.env.example](proxy-scripts/.env.example)

## Security-Related Environment Variables

| 变量 | 用途 | 建议 |
|------|------|------|
| `ADMIN_TOKEN` | 保护 `/api/config` POST | 非 localhost 场景建议设置 |
| `ALLOW_UNAUTH_CONFIG_POST` | 允许无鉴权改配置 | 保持未设置（默认 false） |
| `PROXY_SESSION_SECRET` | 可选上游请求 HMAC 签名 | 若设置，使用随机长字符串，勿入库 |
| `PROXY_DEVICE_ID` | 本地设备标识，扩展注入子进程 | 非密钥；不上传云端 |

## Disclosure Policy

- 确认漏洞后，我们会在修复可用时于 Release / Issue 中说明（不含利用细节）
- 感谢负责任披露；是否署名由报告者决定
