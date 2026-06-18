# Changelog

所有重要更改都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.1.1] - 2026-06-18

### Added
- **标签页式 UI 重构**：全新的 3 标签页布局（配置连接、控制状态、系统补丁），信息分组更清晰
- **快捷键支持**：Cmd/Ctrl + 1/2/3 快速切换标签页，提升专业用户操作效率
- **智能配置徽章**：自动检测配置完整性，未配置时显示警告徽章，配置完整时自动隐藏
- **淡入淡出动画**：流畅的标签页切换体验（0.2s ease-in-out）
- **响应式优化**：完整的小屏幕适配（≤400px），自动调整字体、间距和徽章尺寸
- **视觉增强**：底部彩色激活指示条、改进的阴影效果、BYOK 配置块彩色条纹边框
- HTML 模板纳入 VSIX 打包，修复安装后模板丢失问题

### Changed
- **Provider 模块化拆分**：将 `sidebarProvider.js` 拆分为 5 个独立服务模块（`services/diagnostics`、`services/environmentProbe`、`services/modelFetcher`、`services/promptTemplates`、`services/thinkingEffort`），Provider 代码量减少约 32%
- **视图模块化**：侧栏 HTML 拆分为 `views/templates/partials/`（config-tab、control-tab、system-tab、tutorial），告别单文件 HTML 巨石
- **视觉统一**：侧栏视觉语言统一，输入框溢出修复，提示词重构为可折叠卡片，折叠交互一致化
- 基于上游 v2.1.0 + v2.0.4，包含配置热重载修复、模型验证增强、静默自动保存

### Technical
- 新增 `switchTab()` 函数处理标签页切换
- 新增 `updateTabBadges()` 函数动态更新配置状态
- 新增 CSS 关键帧动画和媒体查询（Tailwind CSS 构建）
- `src/` 目录按功能分层：`managers/`、`providers/`、`services/`、`utils/`、`views/`、`proxy/`
- 178 个单元测试，覆盖 Provider 拆分后的关键路径

## [2.0.4] - 2026-06-16

### Fixed
- 修复配置热重载 Bug：解决 POST 请求超时问题，支持预缓冲请求体
- 增强默认模型验证：提前拦截未配置模型的请求，避免无效 API 调用
- 修复前端 JavaScript 智能引号导致的语法错误

### Added
- 实现静默自动保存功能：配置变更后自动保存（650ms 防抖），提升用户体验
- 新增 7 个单元测试，覆盖配置热重载和模型验证关键路径
- 代码质量提升：提取 `authorizeConfigPost()` 和 `applyConfigPostBody()` 函数，实现关注点分离

### Changed
- 改进错误消息：提供更清晰的配置指引（英文版）
- 优化配置更新流程：支持预缓冲和流式两种请求体处理方式
- 完善函数导出：`requiresConfiguredDefaultModel()` 现在可供外部测试使用

## [2.0.3] - 2026-06-13

### Fixed
- 修复 Anthropic SSE 响应流处理问题，增强流式响应稳定性
- 修复 Bedrock 兼容性问题和配置重载回退机制
- 修复 Windows 本地回环连接和扩展激活崩溃问题

### Changed
- 重构代理脚本架构，优化代码组织和可维护性
- 项目正式更名为 **Devin BYOK Plus**（随 Windsurf → Devin Desktop 品牌更新）
- 更新项目归属信息，明确 fork 关系和致谢说明

### Added
- 新增请求重试机制，提高网络请求可靠性
- 新增熔断机制，防止级联失败
- 完善错误处理和降级策略

## [2.0.2] - 2026-06-10

### Fixed
- 改进网关兼容性
- 修复 MCP 工具过滤问题
- VSIX 升级时保留用户配置

## [2.0.1] - 2026-06-09

### Added
- 发布去混淆可读源代码
- 更新项目文档

## [2.0.0] - 2026-06-08

### Added
- 支持双 BYOK 槽位（BYOK #1 和 BYOK #2）
- 支持多模型路由（Claude / GPT / Gemini）
- 支持思考强度控制（adaptive / budget_tokens / reasoning.effort / thinking_level）
- 完整的网关能力检测和回退机制
- OpenAI Responses API 支持及自动回退
- Gemini 3.x thinking_config 支持

### Changed
- 全面重构代理架构
- 优化配置管理和运行时热更新

## [1.1.0] - 2026-06-07

### Changed
- 品牌更新：Windsurf → Devin Desktop
- 项目更名为 Devin BYOK Bridge
- 保留对旧版 Windsurf 安装路径的兼容

## [1.0.0] - 2026-06-06

### Added
- 初始发布 Windsurf BYOK Bridge
- 基础 BYOK 代理功能
- Claude 模型支持
- 本地代理服务器
- 补丁系统

---

**历史版本**（fork 自 [ycx932436/devin-byok-bridge](https://github.com/ycx932436/devin-byok-bridge)）

感谢原作者 [@ycx932436](https://github.com/ycx932436) 的开创性工作！
