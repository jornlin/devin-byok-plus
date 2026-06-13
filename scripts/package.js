#!/usr/bin/env node

/**
 * VS Code 插件打包脚本
 * 用于构建 .vsix 安装包
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: 'inherit',
      encoding: 'utf-8',
      ...options
    });
  } catch (error) {
    log(`✗ 命令执行失败: ${command}`, colors.red);
    throw error;
  }
}

function checkFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    log(`✗ 缺少文件: ${description} (${filePath})`, colors.red);
    return false;
  }
  log(`✓ 检查通过: ${description}`, colors.green);
  return true;
}

function main() {
  log('\n🚀 开始打包 VS Code 插件...\n', colors.bright + colors.cyan);

  const rootDir = path.resolve(__dirname, '..');
  process.chdir(rootDir);

  // 1. 执行构建
  log('🔨 步骤 1: 构建项目', colors.bright);
  try {
    exec('node scripts/build.js');
    log('✓ 构建完成', colors.green);
  } catch (error) {
    log('✗ 构建失败', colors.red);
    process.exit(1);
  }

  // 2. 检查必要文件
  log('\n📋 步骤 2: 检查必要文件', colors.bright);
  const requiredFiles = [
    ['package.json', 'package.json'],
    ['src/extension.js', '插件入口文件'],
    ['README.md', 'README 文档'],
    ['LICENSE.txt', '许可证文件'],
    ['CHANGELOG.md', '更新日志'],
    ['resources/icons/icon.png', '插件图标（PNG 格式）'],
  ];

  let allFilesExist = true;
  for (const [file, desc] of requiredFiles) {
    if (!checkFile(path.join(rootDir, file), desc)) {
      allFilesExist = false;
    }
  }

  if (!allFilesExist) {
    log('\n✗ 文件检查未通过，请补充缺少的文件', colors.red);
    process.exit(1);
  }

  // 3. 读取版本信息
  log('\n📦 步骤 3: 读取版本信息', colors.bright);
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const { name, version, publisher } = packageJson;
  log(`  插件名称: ${name}`, colors.cyan);
  log(`  版本号: ${version}`, colors.cyan);
  log(`  发布者: ${publisher}`, colors.cyan);

  // 4. 检查并安装 vsce
  log('\n🔧 步骤 4: 检查打包工具', colors.bright);
  try {
    execSync('npx vsce --version', { stdio: 'pipe' });
    log('✓ vsce 工具已就绪', colors.green);
  } catch {
    log('⚠ vsce 未安装，将使用 npx 自动下载', colors.yellow);
  }

  // 5. 准备构建目录
  log('\n📁 步骤 5: 准备构建目录', colors.bright);
  const buildDir = path.join(rootDir, 'build');

  // 创建 build 目录（如果不存在）
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    log('✓ 已创建 build 目录', colors.green);
  }

  // 清理 build 目录中的旧 .vsix 文件
  const oldVsixInBuild = fs.readdirSync(buildDir).filter(f => f.endsWith('.vsix'));
  if (oldVsixInBuild.length > 0) {
    oldVsixInBuild.forEach(file => {
      fs.unlinkSync(path.join(buildDir, file));
      log(`  已删除旧文件: build/${file}`, colors.yellow);
    });
  }

  // 清理根目录中的旧 .vsix 文件
  const oldVsixInRoot = fs.readdirSync(rootDir).filter(f => f.endsWith('.vsix'));
  if (oldVsixInRoot.length > 0) {
    oldVsixInRoot.forEach(file => {
      fs.unlinkSync(path.join(rootDir, file));
      log(`  已删除临时文件: ${file}`, colors.yellow);
    });
  }

  if (oldVsixInBuild.length === 0 && oldVsixInRoot.length === 0) {
    log('✓ 无需清理', colors.green);
  }

  // 6. 执行打包
  log('\n📦 步骤 6: 执行打包', colors.bright);
  const outputFile = `${name}-${version}.vsix`;

  try {
    exec('npx @vscode/vsce package --no-dependencies');
    log(`\n✓ 打包成功！`, colors.green);
  } catch (error) {
    log('\n✗ 打包失败', colors.red);
    process.exit(1);
  }

  // 7. 移动到 build 目录
  log('\n📦 步骤 7: 移动到 build 目录', colors.bright);
  const sourceFile = path.join(rootDir, outputFile);
  const targetFile = path.join(buildDir, outputFile);

  if (fs.existsSync(sourceFile)) {
    fs.renameSync(sourceFile, targetFile);
    log(`✓ 已移动到: build/${outputFile}`, colors.green);
  } else {
    log('✗ 未找到打包文件', colors.red);
    process.exit(1);
  }

  // 8. 验证打包结果
  log('\n✅步骤 8: 验证打包结果', colors.bright);
  if (fs.existsSync(targetFile)) {
    const stats = fs.statSync(targetFile);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    log(`✓ 安装包已生成: ${outputFile}`, colors.green);
    log(`  文件大小: ${sizeInMB} MB`, colors.cyan);
    log(`  保存路径: ${targetFile}`, colors.cyan);
  } else {
    log('✗ 验证失败', colors.red);
    process.exit(1);
  }

  // 9. 显示安装说明
  log('\n📖 安装说明:', colors.bright);
  log(`  方法 1 - GUI 安装:`, colors.cyan);
  log(`    1. 打开 VS Code`, colors.cyan);
  log(`    2. 打开扩展面板（Ctrl+Shift+X 或 Cmd+Shift+X）`, colors.cyan);
  log(`    3. 点击右上角 "..." 菜单`, colors.cyan);
  log(`    4. 选择 "从 VSIX 安装..."`, colors.cyan);
  log(`    5. 选择文件: build/${outputFile}`, colors.cyan);
  log(`\n  方法 2 - 命令行安装:`, colors.cyan);
  log(`    code --install-extension build/${outputFile}`, colors.cyan);

  log('\n🎉 打包流程完成！\n', colors.bright + colors.green);
}

// 执行主函数
try {
  main();
} catch (error) {
  log(`\n✗ 打包过程出错: ${error.message}`, colors.red);
  process.exit(1);
}
