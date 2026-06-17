/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/views/**/*.{js,html}',
    './resources/webviews/**/*.js'
  ],
  darkMode: 'class',
  corePlugins: {
    preflight: false, // 关闭 reset，避免覆盖 VS Code webview 基础样式
  },
  theme: {
    extend: {
      colors: {
        // VS Code 主题变量映射（确保跟随用户主题）
        vsfg: 'var(--vscode-foreground)',
        vsbg: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
        vsinput: 'var(--vscode-input-background, var(--vscode-editor-background))',
        vsborder: 'var(--vscode-panel-border, var(--vscode-widget-border))',
        vswidget: 'var(--vscode-editorWidget-background, var(--vscode-sideBar-background))',
        vsdesc: 'var(--vscode-descriptionForeground)',
        vsdisabled: 'var(--vscode-disabledForeground)',
        vslink: 'var(--vscode-textLink-foreground)',
        vsinputfg: 'var(--vscode-input-foreground, var(--vscode-foreground))',
        vsbtn: 'var(--vscode-button-background)',
        vsbtnhover: 'var(--vscode-button-hoverBackground)',

        // 语义状态色（固定值，与现状保持一致）
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
