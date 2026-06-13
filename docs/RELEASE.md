# 发布流程

本项目使用配置文件驱动的自动化发布流程。

## 快速发布

1. **修改配置文件** `release.config.json`：

```json
{
  "version": "2.0.4",
  "changeType": "Fixed",
  "changes": [
    "修复代理服务器启动失败的问题",
    "优化错误处理逻辑"
  ],
  "autoPackage": true
}
```

2. **运行发布脚本**：

```bash
npm run release
```

就这么简单！脚本会自动完成：
- 更新 `package.json` 中的版本号
- 在 `CHANGELOG.md` 中添加变更记录
- 如果 `autoPackage: true`，自动执行打包

## 配置说明

### `release.config.json` 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `version` | string | ✓ | 新版本号，格式为 `x.y.z` |
| `changeType` | string | ✓ | 变更类型，见下表 |
| `changes` | string[] | ✓ | 变更内容列表 |
| `autoPackage` | boolean | ✗ | 是否自动打包（默认 false） |

### 变更类型（changeType）

| 值 | 说明 | 使用场景 |
|----|------|----------|
| `Added` | 新增功能 | 添加新特性、新功能 |
| `Changed` | 变更 | 修改现有功能的行为 |
| `Fixed` | 修复 | Bug 修复 |
| `Deprecated` | 弃用 | 标记即将移除的功能 |
| `Removed` | 移除 | 删除已弃用的功能 |
| `Security` | 安全 | 安全相关的更新 |

## 完整发布流程

### 1. 准备发布

修改 `release.config.json`：

```json
{
  "version": "2.1.0",
  "changeType": "Added",
  "changes": [
    "支持自定义模型配置",
    "添加请求重试机制",
    "优化代理服务器性能"
  ],
  "autoPackage": true
}
```

### 2. 执行发布

```bash
npm run release
```

输出示例：
```
🚀 版本发布自动化脚本

✓ 已更新 package.json 版本号: 2.0.3 → 2.1.0
✓ 已更新 CHANGELOG.md

📋 发布摘要:
  版本: 2.0.3 → 2.1.0
  类型: Added
  变更内容:
    - 支持自定义模型配置
    - 添加请求重试机制
    - 优化代理服务器性能

开始打包...
[打包过程...]

✅ 版本发布完成！

下一步:
  1. 测试安装: code --install-extension build/devin-byok-plus-2.1.0.vsix
  2. 提交代码: git add . && git commit -m "chore: release v2.1.0"
  3. 创建标签: git tag v2.1.0
  4. 推送代码: git push && git push --tags
```

### 3. 测试安装

```bash
code --install-extension build/devin-byok-plus-2.1.0.vsix
```

### 4. 提交和推送

```bash
git add .
git commit -m "chore: release v2.1.0"
git tag v2.1.0
git push && git push --tags
```

## 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

- **主版本号（Major）**：不兼容的 API 修改
- **次版本号（Minor）**：向下兼容的功能性新增
- **修订号（Patch）**：向下兼容的问题修正

示例：
- `2.0.0` → `3.0.0`：重大重构，不兼容旧版本
- `2.0.0` → `2.1.0`：添加新功能，兼容旧版本
- `2.0.0` → `2.0.1`：修复 Bug，兼容旧版本

## 示例场景

### Bug 修复发布

```json
{
  "version": "2.0.4",
  "changeType": "Fixed",
  "changes": [
    "修复代理服务器无法启动的问题",
    "修复配置文件加载错误"
  ],
  "autoPackage": true
}
```

### 新功能发布

```json
{
  "version": "2.1.0",
  "changeType": "Added",
  "changes": [
    "添加自定义模型配置功能",
    "支持请求拦截和修改",
    "新增日志导出功能"
  ],
  "autoPackage": true
}
```

### 重构发布

```json
{
  "version": "2.2.0",
  "changeType": "Changed",
  "changes": [
    "重构代理服务器架构",
    "优化配置加载逻辑",
    "改进错误处理机制"
  ],
  "autoPackage": true
}
```

### 安全更新

```json
{
  "version": "2.0.5",
  "changeType": "Security",
  "changes": [
    "修复 XSS 漏洞",
    "更新依赖包以修复安全问题"
  ],
  "autoPackage": true
}
```

## 常见问题

### Q: 如果不想自动打包怎么办？

A: 将 `autoPackage` 设为 `false` 或删除该字段：

```json
{
  "version": "2.0.4",
  "changeType": "Fixed",
  "changes": ["修复问题"],
  "autoPackage": false
}
```

然后手动运行 `npm run package`。

### Q: 如何添加多条变更记录？

A: `changes` 字段是数组，可以添加多条：

```json
{
  "changes": [
    "第一条变更",
    "第二条变更",
    "第三条变更"
  ]
}
```

### Q: 配置文件格式错误怎么办？

A: 脚本会自动检测并提示错误，按照提示修复即可。常见错误：
- 版本号格式不对（必须是 `x.y.z`）
- `changeType` 拼写错误
- `changes` 不是数组或为空

### Q: 能否跳过某些步骤？

A: 目前脚本会自动完成版本号和 CHANGELOG 更新，打包步骤可通过 `autoPackage` 控制。如需更灵活的控制，可以手动执行各个步骤。
