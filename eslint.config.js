import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '*.min.js',
    ],
  },
];
