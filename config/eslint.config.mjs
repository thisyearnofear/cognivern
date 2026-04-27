import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from './prettier.config.mjs';

/** @type {import("eslint").Linter.FlatConfig[]} */ // ✅ Explicitly define type
const config = [
  {
    files: ['src/frontend/**/*.ts', 'src/frontend/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./src/frontend/tsconfig.app.json'],
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      prettier,
    },
    rules: {
      ...ts.configs.recommended.rules,
      'prettier/prettier': ['error', prettierConfig],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '**/*.min.js', '**/vendor/**'],
  },
];

export default config;
