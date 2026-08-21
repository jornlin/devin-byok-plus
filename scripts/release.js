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

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * 取 CHANGELOG.md 里最靠上的已发布版本条目。
 * 正则只认 x.y.z，[Unreleased] 这类条目会被自动跳过。
 */
function readChangelogTop() {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) return null;
  const matched = fs
    .readFileSync(changelogPath, 'utf-8')
    .match(/^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\S+))?/m);
  return matched ? { version: matched[1], date: matched[2] || '' } : null;
}

/**
 * 发布前一致性校验。
 *
 * release.config.json 是版本号的唯一事实来源，package.json 只是它的下游产物
 * （updatePackageJson 会无条件覆写）。所以当有人直接改了 package.json 却忘了同步
 * 这里时，跑一次发布就会把版本号悄悄退回去，打出的包会被 IDE 当成旧版本，
 * 既不提示更新也可能拒绝安装。这道检查就是拦这个的。
 */
function checkConsistency(config, force) {
  const problems = [];
  const warnings = [];

  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkgVersion = JSON.parse(fs.readFileSync(packagePath, 'utf-8')).version;

  if (compareVersions(config.version, pkgVersion) < 0) {
    problems.push(
      `版本号会倒退：release.config.json 是 ${config.version}，package.json 已经是 ${pkgVersion}\n` +
      `    继续执行会把 package.json 覆写成旧版本，打出的包 IDE 会当成降级。\n` +
      `    通常是改了 package.json 却漏了 release.config.json。`
    );
  }

  const changelog = readChangelogTop();
  if (!changelog) {
    warnings.push('CHANGELOG.md 里没有形如「## [x.y.z]」的条目，跳过比对');
  } else if (changelog.version !== config.version) {
    problems.push(
      `CHANGELOG 对不上：CHANGELOG.md 顶部是 ${changelog.version}，release.config.json 是 ${config.version}\n` +
      `    请先把本次变更写进 CHANGELOG.md 再发布。`
    );
  } else if (config.releaseDate && changelog.date && changelog.date !== config.releaseDate) {
    warnings.push(
      `发布日期不一致：CHANGELOG.md 是 ${changelog.date}，release.config.json 是 ${config.releaseDate}`
    );
  }

  warnings.forEach((w) => log(`⚠ ${w}`, colors.yellow));

  if (problems.length === 0) {
    log('✓ 发布前检查通过：版本号与 CHANGELOG 一致', colors.green);
    return true;
  }

  log('\n✗ 发布前检查未通过：', colors.red);
  problems.forEach((p) => log(`  • ${p}`, colors.red));

  if (force) {
    log('\n⚠ 已指定 --force，忽略以上问题继续发布', colors.yellow);
    return true;
  }

  log('\n修正后重新运行；确需跳过检查时加 --force\n', colors.yellow);
  return false;
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

  const force = process.argv.includes('--force');
  const config = readConfig();

  if (!validateConfig(config)) {
    process.exit(1);
  }

  if (!checkConsistency(config, force)) {
    process.exit(1);
  }

  const { version, changeType, changes, autoPackage } = config;

  const oldVersion = updatePackageJson(version);
  log(`✓ 已更新 package.json 版本号: ${oldVersion} → ${version}`, colors.green);

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
