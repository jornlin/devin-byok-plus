# 贡献指南

感谢关注 **Windsurf BYOK Bridge**。本文档说明如何安全地参与本仓库，**不涉及源码实现细节**。

## 开始前请阅读

- [DISCLAIMER.md](DISCLAIMER.md) — 法律风险与免责声明
- [SECURITY.md](SECURITY.md) — 安全策略与敏感文件清单

## 设计定位

本项目**仅面向本地单机使用**（默认 `127.0.0.1`）。Issue 与 PR 请在此前提下描述问题。

## 请勿提交的内容

以下内容**永远不应**进入 Git 历史：

| 路径 / 类型 | 说明 |
|-------------|------|
| `proxy-scripts/.env` | 含 API Key 与网关配置 |
| `proxy-scripts/certs/` | MITM 证书与私钥 |
| `*.vsix` | 打包产物可能内嵌本地配置 |
| `**/captures/**` | 抓包或调试捕获 |
| `proxy-scripts/debug/` | 本地调试输出 |
| `_deob_test/` | 本地测试目录 |

仓库已用 `.gitignore` 排除上述路径；提交前请执行 `git status` 人工复核。

环境变量模板见 [proxy-scripts/.env.example](proxy-scripts/.env.example)。

## 源码说明

仓库中部分代码经**故意混淆**，用于限制非本地场景的随意复用。这属于项目既定策略，**不是**疏漏。

- 请勿在 Issue 中要求「完全去混淆」作为合并条件；
- 安全报告请描述**影响与复现**，无需逐行审计混淆代码；
- 功能建议与文档修正同样欢迎。

## 如何贡献

### 文档

- 修正 README、DISCLAIMER、SECURITY 中的错误或遗漏
- 补充 FAQ、安装说明、兼容性说明

### Issue

- Bug：说明 Windsurf 版本、操作系统、复现步骤与期望行为
- 功能建议：说明使用场景与限制
- **勿**在公开 Issue 粘贴 API Key、`.env`、MITM 私钥或完整诊断报告

### Pull Request

1. Fork 后从 `main` 创建分支
2. 保持改动范围聚焦
3. PR 描述中说明「测了什么 / 没测什么」
4. 确认未包含 `.env`、证书、VSIX 等敏感文件

## 安全漏洞

请通过 [GitHub Security Advisories](https://github.com/ycx932436/windsurf-byok-bridge/security/advisories/new) 私下报告，不要公开利用细节。

以下通常**不在**本仓库受理范围内（见 SECURITY.md）：

- 用户自行将 `.env` 提交到 Git
- 在**非设计场景**下将代理暴露到公网
- 违反 Windsurf / Codeium 服务条款本身
- 上游模型网关的缺陷

## 许可

贡献的文档与代码按 [MIT License](LICENSE.txt) 授权；提交 PR 即表示你同意此许可。
