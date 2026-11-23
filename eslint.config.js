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
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // GEF uses generic constructors and function metadata at runtime boundaries.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // Signal subscriptions intentionally capture the current instance.
      '@typescript-eslint/no-this-alias': 'off',
      'no-debugger': 'error',
    },
  },
  {
    files: [
      'packages/compiler/src/gtpl/codegen/expression.spec.ts',
      'packages/compiler/src/gtpl/expression/parser.ts',
      'packages/compiler/src/gtpl/parser/parser.spec.ts',
    ],
    rules: {
      // These fixtures intentionally contain escaped quotes in GTPL source strings.
      'no-useless-escape': 'off',
    },
  },
);
