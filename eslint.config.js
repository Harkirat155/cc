// Flat ESLint config for React (Vite) frontend and Node (ESM) backend
// Requires: eslint ^9, @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Global ignores
  {
    name: 'ignores',
    ignores: [
      'node_modules',
      'dist',
      'build',
      '.vite',
      '.vercel',
      '.render',
      '**/*.min.js',
    ],
  },

  // Base JS/JSX rules
  js.configs.recommended,

  // Frontend: React rules
  {
    name: 'react-frontend',
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
  rules: {
      // React recommended + new JSX runtime
      ...react.configs.recommended.rules,
      ...(react.configs['jsx-runtime']?.rules || {}),
      ...reactHooks.configs.recommended.rules,

      // Project-friendly tweaks
      'no-console': 'off',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|_)' }],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },

  // Backend: Node server (ESM)
  {
    name: 'node-backend',
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Tooling config files (CommonJS style)
  {
    name: 'tooling-configs-commonjs',
    files: ['postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },

  // Tooling config files (ESM style)
  {
    name: 'tooling-configs-esm',
    files: ['eslint.config.js', 'vite.config.js', 'jest.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
  },

  // Test files (Jest globals)
  {
    name: 'tests',
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^(React|_)' }],
    },
  },
];
