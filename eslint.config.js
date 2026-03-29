import tsParser from '@typescript-eslint/parser';
import architectureConfig from './eslint.architecture.config.js';

export default [
  {
    ignores: ['dist/**', 'dist-electron/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'max-lines': [
        'error',
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'no-restricted-imports': 'off',
    },
  },
  ...architectureConfig,
];
