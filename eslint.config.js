import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/cli/data/**',
      'packages/mcp/data/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_|^spin$', // IconProps.spin 按契约接受但忽略
          varsIgnorePattern: '^_',
        },
      ],
    },
  }
);
