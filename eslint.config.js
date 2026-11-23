import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        print: 'readonly',
      },
    },
  },
  {
    files: [
      'eslint.config.js',
      'scripts/**/*.mjs',
      'packages/examples/**/*.mjs',
      'tests/**/*.mjs',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      'no-debugger': 'error',
    },
  },
);
