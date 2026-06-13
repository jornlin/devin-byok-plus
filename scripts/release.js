#!/usr/bin/env node

/**
 * 配置文件驱动的版本发布脚本
 * 修改 release.config.json 后直接运行即可完成发布
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function readConfig() {
  const configPath = path.join(__dirname, '..', 'release.config.json');

  if (!fs.existsSync(configPath)) {
    log('✗ 未找到 release.config.json 配置文件', colors.red);
    log('请在项目根目录创建 release.config.json 文件，示例：', colors.yellow);
    log(JSON.stringify({
      version: '2.0.3',
      changeType: 'Fixed',
      changes: [
        '修复代理服务器启动失败的问题',
        '优化错误处理逻辑'
      ],
      autoPackage: true
    }, null, 2), colors.cyan);
    process.exit(1);
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    log(`✗ 配置文件解析失败: ${error.message}`, colors.red);
    process.exit(1);
  }
}

function validateConfig(config) {
  if (!config.version || !config.version.match(/^\d+\.\d+\.\d+$/)) {
    log('✗ version 格式错误，应为 x.y.z 格式', colors.red);
    return false;
  }

  const validTypes = ['Added', 'Changed', 'Fixed', 'Deprecated', 'Removed', 'Security'];
  if (!config.changeType || !validTypes.includes(config.changeType)) {
    log(`✗ changeType 无效，应为以下之一: ${validTypes.join(', ')}`, colors.red);
    return false;
  }

  if (!Array.isArray(config.changes) || config.changes.length === 0) {
    log('✗ changes 应为非空数组', colors.red);
    return false;
  }

  return true;
}

function updatePackageJson(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const oldVersion = packageJson.version;

  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

  return oldVersion;
}

function updateChangelog(version, changeType, changes) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const today = new Date().toISOString().split('T')[0];

  let changelog = fs.readFileSync(changelogPath, 'utf-8');

  const changeItems = changes.map(change => `- ${change}`).join('\n');
  const newEntry = `## [${version}] - ${today}

### ${changeType}
${changeItems}

`;

  const insertPos = changelog.indexOf('## [');
  if (insertPos !== -1) {
    changelog = changelog.slice(0, insertPos) + newEntry + changelog.slice(insertPos);
  } else {
    changelog += '\n' + newEntry;
  }

  fs.writeFileSync(changelogPath, changelog);
}

function runPackage() {
  log('\n开始打包...', colors.cyan);
  try {
    execSync('npm run package', { stdio: 'inherit' });
    return true;
  } catch (error) {
    log('\n✗ 打包失败', colors.red);
    return false;
  }
}

function main() {
  log('\n🚀 版本发布自动化脚本\n', colors.bright + colors.cyan);

  const config = readConfig();

  if (!validateConfig(config)) {
    process.exit(1);
  }

  const { version, changeType, changes, autoPackage } = config;

  const oldVersion = updatePackageJson(version);
  log(`✓ 已更新 package.json 版本号: ${oldVersion} → ${version}`, colors.green);

  updateChangelog(version, changeType, changes);
  log(`✓ 已更新 CHANGELOG.md`, colors.green);

  log('\n📋 发布摘要:', colors.bright);
  log(`  版本: ${oldVersion} → ${version}`, colors.cyan);
  log(`  类型: ${changeType}`, colors.cyan);
  log(`  变更内容:`, colors.cyan);
  changes.forEach(change => log(`    - ${change}`, colors.cyan));

  if (autoPackage) {
    const success = runPackage();
    if (!success) {
      process.exit(1);
    }
  }

  log('\n✅ 版本发布完成！', colors.green);
  log('\n下一步:', colors.cyan);
  if (!autoPackage) {
    log('  1. 运行打包: npm run package');
  }
  log(`  ${autoPackage ? '1' : '2'}. 测试安装: code --install-extension build/devin-byok-plus-${version}.vsix`);
  log(`  ${autoPackage ? '2' : '3'}. 提交代码: git add . && git commit -m "chore: release v${version}"`);
  log(`  ${autoPackage ? '3' : '4'}. 创建标签: git tag v${version}`);
  log(`  ${autoPackage ? '4' : '5'}. 推送代码: git push && git push --tags\n`);
}

main();
