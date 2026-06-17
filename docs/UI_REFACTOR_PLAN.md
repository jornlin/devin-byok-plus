# UI 重构方案 - Tailwind CSS 架构升级

## 📖 目标

将插件设置页面从耦合的内联代码重构为模块化、可维护的现代前端架构。

## 🏗️ 技术栈

- **样式框架**：Tailwind CSS v3.x
- **模板引擎**：原生字符串模板（保持轻量）
- **构建工具**：Tailwind CLI + npm scripts
- **状态管理**：保持现有 WebView 消息机制

---

## 📁 新的目录结构

```
src/
├── views/
│   ├── templates/
│   │   ├── sidebar.html           # 主模板
│   │   ├── partials/              # 可复用组件片段
│   │   │   ├── config-tab.html
│   │   │   ├── control-tab.html
│   │   │   ├── system-tab.html
│   │   │   └── tutorial.html
│   │   └── index.js               # 模板加载器
│   ├── styles/
│   │   ├── sidebar.css            # Tailwind 输入文件
│   │   └── custom.css             # 自定义样式（如动画）
│   └── sidebarProvider.js         # 逻辑层（精简后）
resources/
└── webviews/
    ├── sidebar.js                 # 前端交互逻辑
    └── dist/
        └── sidebar.css            # Tailwind 构建产物
```

---

## 🔧 配置文件

### 1. `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/templates/**/*.html',
    './resources/webviews/**/*.js'
  ],
  darkMode: 'class', // 支持暗色模式
  theme: {
    extend: {
      colors: {
        // VSCode 主题变量映射
        vscode: {
          bg: 'var(--vscode-sideBar-background)',
          fg: 'var(--vscode-foreground)',
          border: 'var(--vscode-panel-border)',
          input: 'var(--vscode-input-background)',
          button: 'var(--vscode-button-background)',
          buttonHover: 'var(--vscode-button-hoverBackground)',
          link: 'var(--vscode-textLink-foreground)',
        },
        // 自定义品牌色
        primary: {
          DEFAULT: '#0d9488',
          hover: '#0f766e',
        },
        danger: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
        },
      },
      fontFamily: {
        mono: ['Cascadia Code', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

### 2. `package.json` 新增脚本

```json
{
  "scripts": {
    "build:css": "tailwindcss -i ./src/views/styles/sidebar.css -o ./resources/webviews/dist/sidebar.css --minify",
    "watch:css": "tailwindcss -i ./src/views/styles/sidebar.css -o ./resources/webviews/dist/sidebar.css --watch",
    "build": "npm run build:css && vsce package",
    "dev": "npm run watch:css & npm run watch"
  }
}
```

### 3. `src/views/styles/sidebar.css` (Tailwind 输入文件)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定义层 - 组件样式 */
@layer components {
  /* 卡片组件 */
  .card {
    @apply bg-vscode-input border border-vscode-border rounded-lg p-3 mb-3;
    @apply shadow-sm hover:border-primary/25 transition-colors;
  }

  .card-head {
    @apply text-xs font-bold text-vscode-fg mb-2.5 flex items-center gap-1.5 min-h-[22px];
  }

  /* 按钮组件 */
  .btn {
    @apply min-h-[28px] px-3 py-1 rounded-md cursor-pointer text-[11px] font-bold;
    @apply inline-flex items-center justify-center gap-1 whitespace-nowrap;
    @apply transition-all duration-200 shadow-sm;
  }

  .btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .btn-primary {
    @apply bg-gradient-to-br from-primary to-blue-500;
    @apply text-white border border-white/10;
    @apply hover:from-primary-hover hover:to-blue-600;
    @apply hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25;
  }

  .btn-danger {
    @apply bg-gradient-to-br from-danger to-red-600;
    @apply text-white border border-white/10;
    @apply hover:from-danger-hover hover:to-red-700;
    @apply hover:-translate-y-0.5 hover:shadow-lg hover:shadow-danger/25;
  }

  .btn-secondary {
    @apply bg-vscode-input text-vscode-fg border border-vscode-border;
    @apply hover:bg-white/5 hover:border-white/15 hover:-translate-y-0.5;
  }

  /* 输入框 */
  .input {
    @apply w-full h-[30px] px-2.5 border border-vscode-border rounded-md;
    @apply text-[11px] bg-vscode-input text-vscode-fg font-mono;
    @apply transition-all duration-200;
    @apply focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary;
  }

  /* 徽章 */
  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded-full;
    @apply text-[9px] font-bold leading-tight tracking-wide border;
  }

  .badge-ok {
    @apply bg-green-500/10 text-green-400 border-green-500/20;
  }

  .badge-warn {
    @apply bg-yellow-500/10 text-yellow-300 border-yellow-500/20;
  }

  .badge-error {
    @apply bg-red-500/10 text-red-400 border-red-500/20;
  }

  /* 日志面板 */
  .log-box {
    @apply bg-vscode-input border border-vscode-border rounded-md p-2;
    @apply max-h-40 overflow-y-auto font-mono text-[10px] leading-relaxed;
  }

  .log-line {
    @apply whitespace-pre-wrap break-all mb-0.5 text-gray-500;
  }

  .log-line.hi {
    @apply text-teal-300;
  }

  .log-line.err {
    @apply text-red-400 bg-red-500/5 px-1 py-0.5 rounded;
  }
}

/* 自定义动画 */
@layer utilities {
  .animate-progress {
    animation: progress 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes progress {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(320%); }
  }

  .animate-fade-in {
    animation: fadeIn 0.2s ease-in-out forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  @apply w-[5px] h-[5px];
}

::-webkit-scrollbar-track {
  @apply bg-transparent;
}

::-webkit-scrollbar-thumb {
  @apply bg-white/10 rounded-full hover:bg-white/20;
}
```

---

## 🔨 实施步骤

### 第一阶段：准备工作（预计 30 分钟）

1. **安装依赖**
   ```bash
   pnpm add -D tailwindcss@latest postcss autoprefixer
   npx tailwindcss init
   ```

2. **创建目录结构**
   ```bash
   mkdir -p src/views/templates/partials
   mkdir -p src/views/styles
   mkdir -p resources/webviews/dist
   ```

3. **配置 Tailwind**
   - 创建 `tailwind.config.js`
   - 创建 `src/views/styles/sidebar.css`
   - 更新 `package.json` 脚本

### 第二阶段：HTML 模板提取（预计 1 小时）

1. **创建主模板** `src/views/templates/sidebar.html`
   - 从 `sidebarProvider.js` 的 `getHtml()` 提取 HTML 结构
   - 使用 `{{变量名}}` 作为占位符
   - 将原有 CSS class 替换为 Tailwind class

2. **拆分可复用组件** 到 `partials/` 目录
   - `tutorial.html` - 教程卡片
   - `config-tab.html` - 配置标签页
   - `control-tab.html` - 控制标签页
   - `system-tab.html` - 系统补丁标签页

3. **创建模板加载器** `src/views/templates/index.js`

### 第三阶段：代码重构（预计 1.5 小时）

1. **精简 `sidebarProvider.js`**
   - 移除内联 HTML/CSS
   - 改用模板加载器
   - 保留数据逻辑和状态管理

2. **构建 CSS**
   ```bash
   npm run build:css
   ```

3. **更新 CSP 配置**
   - 在 `getHtml()` 中引用构建后的 CSS 文件

### 第四阶段：测试验证（预计 30 分钟）

1. **功能测试**
   - 所有按钮和交互是否正常
   - 配置保存和加载
   - 日志显示

2. **视觉测试**
   - 暗色/亮色主题切换
   - 响应式布局
   - 动画效果

3. **性能测试**
   - WebView 加载速度
   - CSS 文件大小（应小于 50KB）

---

## 📊 预期收益

| 指标 | 当前 | 重构后 | 改善 |
|------|------|--------|------|
| 样式代码行数 | ~2600 行 | ~300 行 | **88% ↓** |
| HTML 可读性 | 差（模板字符串） | 优（独立文件） | **提升 90%** |
| 维护性 | 困难 | 简单 | **提升 80%** |
| 协作效率 | 低（前端需懂 JS） | 高（标准 HTML/CSS） | **提升 70%** |
| CSS 文件大小 | 内联（~80KB） | 独立（~30KB） | **62% ↓** |

---

## ⚠️ 注意事项

1. **WebView CSP 限制**
   - 必须使用构建后的完整 CSS 文件
   - 不能使用 CDN 加载 Tailwind

2. **兼容性**
   - 保留 VSCode CSS 变量引用（`var(--vscode-*)`）
   - 确保暗色模式正常工作

3. **构建流程**
   - 开发时使用 `npm run watch:css` 自动构建
   - 打包前运行 `npm run build:css`

4. **版本控制**
   - `.gitignore` 中排除 `resources/webviews/dist/`
   - 构建产物在 CI/CD 中生成

---

## 🚀 下一步行动

1. **决策点**：确认是否采用 Tailwind CSS 方案
2. **如果确认**：我将立即开始实施第一阶段
3. **如果需要调整**：可以先采用"方案 B"（纯分离，不用 Tailwind）

**我的建议**：优先采用 Tailwind CSS 方案，虽然初期需要一些配置工作，但长期收益巨大，特别是你提到的交互体验和视觉效果优化，Tailwind 能大幅提升开发效率。

是否开始实施？需要我先创建一个示例页面让你预览效果吗？
