const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 清理 dist 目录
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 编译 Tailwind CSS
console.log('🎨 Building Tailwind CSS...');
const rootDir = path.join(__dirname, '..');
const cssInput = path.join(rootDir, 'src', 'views', 'styles', 'sidebar.css');
const cssOutput = path.join(rootDir, 'resources', 'webviews', 'dist', 'sidebar.css');
const cssOutputDir = path.dirname(cssOutput);

if (!fs.existsSync(cssOutputDir)) {
  fs.mkdirSync(cssOutputDir, { recursive: true });
}

try {
  execSync(
    `npx tailwindcss -i "${cssInput}" -o "${cssOutput}" --minify`,
    { cwd: rootDir, stdio: 'inherit' }
  );
  console.log('✅ Tailwind CSS built successfully');
} catch (err) {
  console.error('❌ Tailwind CSS build failed:', err.message);
  process.exit(1);
}

console.log('🔨 Building extension...');

esbuild
  .build({
    entryPoints: ['src/extension.js'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    platform: 'node',
    target: 'node16',
    format: 'cjs',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    logLevel: 'info',
  })
  .then(() => {
    console.log('✅ Build completed successfully');

    // 复制 proxy 运行时代码
    console.log('📦 Copying proxy runtime...');
    const proxySource = path.join(__dirname, '..', 'src', 'proxy');
    const proxyTarget = path.join(__dirname, '..', 'proxy-scripts', 'src');

    if (!fs.existsSync(proxySource)) {
      console.error('❌ Source proxy directory not found:', proxySource);
      process.exit(1);
    }

    // 清理目标目录
    if (fs.existsSync(proxyTarget)) {
      fs.rmSync(proxyTarget, { recursive: true, force: true });
    }

    // 复制代码
    fs.cpSync(proxySource, proxyTarget, { recursive: true });
    console.log('✅ Proxy runtime copied successfully');
  })
  .catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
  });
