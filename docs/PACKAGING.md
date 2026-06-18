# VS Code 插件打包指南

本指南说明如何将 Devin BYOK Plus 打包成 VS Code 插件安装包（.vsix 文件）。

## 快速开始

### 方法 1：使用 npm 脚本（推荐）

```bash
npm run package
```

### 方法 2：使用 Shell 脚本

```bash
./package.sh
```

### 方法 3：手动打包

```bash
npx @vscode/vsce package --no-dependencies
```

## 打包前检查清单

打包前请确保以下内容已正确配置：

### 1. package.json 必填字段

- ✅ `name`: 插件唯一标识符（小写，无空格）
- ✅ `displayName`: 显示名称
- ✅ `description`: 插件描述
- ✅ `version`: 版本号（遵循语义化版本）
- ✅ `publisher`: 发布者 ID
- ✅ `engines.vscode`: 最低 VS Code 版本要求
- ✅ `license`: 许可证类型
- ✅ `repository`: 代码仓库地址
- ✅ `icon`: 插件图标路径

### 2. 必需文件

- ✅ `package.json` - 插件清单（`main` 指向 `./src/extension.js`）
- ✅ `src/extension.js` - 插件入口文件
- ✅ `README.md` - 使用说明
- ✅ `LICENSE.txt` - 许可证文件
- ✅ `CHANGELOG.md` - 更新日志
- ✅ `resources/icons/icon.png` - 插件图标

### 3. .vscodeignore 配置

确保排除不必要的文件以减小包体积：
- 开发工具配置（.vscode, .idea, .git）
- 测试文件和脚本
- node_modules（使用 `--no-dependencies` 标志）
- 临时文件和日志

## 版本管理

### 更新版本号

编辑 `package.json` 中的 `version` 字段：

```json
{
  "version": "2.1.1"  // 主版本.次版本.修订号
}
```

**语义化版本规则：**
- **主版本**（Major）：不兼容的 API 变更
- **次版本**（Minor）：向后兼容的功能新增
- **修订号**（Patch）：向后兼容的问题修复

### 更新 CHANGELOG.md

每次发布前，在 `CHANGELOG.md` 中记录变更：

```markdown
## [2.1.2] - 2026-06-20

### 新增
- 新功能描述

### 修复
- Bug 修复描述
```

## 打包输出

成功打包后会在 `build/` 目录生成：

```
build/devin-byok-plus-2.1.1.vsix
```

文件命名格式：`{name}-{version}.vsix`

## 安装打包好的插件

### 方法 1：通过 VS Code GUI 安装

1. 打开 VS Code
2. 打开扩展面板（`Ctrl+Shift+X` 或 `Cmd+Shift+X`）
3. 点击右上角 `...` 菜单
4. 选择 **从 VSIX 安装...**
5. 选择生成的 `.vsix` 文件

### 方法 2：通过命令行安装

```bash
code --install-extension build/devin-byok-plus-2.1.1.vsix
```

### 方法 3：手动安装

将 `build/` 目录中的 `.vsix` 文件拖拽到 VS Code 窗口中。

## 发布到市场（可选）

### 前置要求

1. 注册 [Visual Studio Marketplace](https://marketplace.visualstudio.com/) 账号
2. 创建发布者账号（Publisher）
3. 生成个人访问令牌（PAT）

### 发布命令

```bash
# 首次发布前登录
npx vsce login <publisher-name>

# 发布到市场
npm run vsce:publish

# 或手动指定版本号
npx vsce publish patch  # 2.1.1 -> 2.1.2
npx vsce publish minor  # 2.1.1 -> 2.2.0
npx vsce publish major  # 2.1.1 -> 3.0.0
```

## 常见问题

### Q: 打包时报错 "Missing publisher name"

**A**: 确保 `package.json` 中有 `publisher` 字段。

### Q: 打包体积过大

**A**: 检查 `.vscodeignore` 是否正确配置，确保排除了：
- `node_modules/**`
- `test/**`
- `.git/**`
- 其他开发文件

### Q: 安装后插件无法激活

**A**: 检查：
- `engines.vscode` 版本是否与目标 VS Code 兼容
- `activationEvents` 是否正确配置
- `main` 字段是否指向正确的入口文件

## 自动化脚本说明

### `scripts/package.js`

Node.js 打包脚本，执行以下步骤：
1. 检查必要文件是否存在
2. 读取版本信息
3. 清理旧的 `.vsix` 文件
4. 执行 `vsce package` 命令
5. 验证打包结果
6. 显示安装说明

### `package.sh`

Bash 封装脚本，调用 Node.js 打包脚本。

## 持续集成（CI/CD）

如需自动化打包，可在 GitHub Actions 中使用：

```yaml
- name: Package Extension
  run: npm run package

- name: Upload VSIX
  uses: actions/upload-artifact@v3
  with:
    name: vsix-package
    path: "*.vsix"
```

## 相关资源

- [VS Code 扩展开发文档](https://code.visualstudio.com/api)
- [vsce 工具文档](https://github.com/microsoft/vscode-vsce)
- [发布扩展指南](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [语义化版本规范](https://semver.org/lang/zh-CN/)

## 技术支持

遇到问题请提交 [Issue](https://github.com/jornlin/devin-byok-plus/issues)。
