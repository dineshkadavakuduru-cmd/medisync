module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  env: { es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  ignorePatterns: ['**/dist/**', '**/.expo/**', '**/.next/**', '**/out/**', '**/coverage/**'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      rules: {
        // TypeScript checks names; the core rules misinterpret type-only syntax.
        'no-undef': 'off',
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'error',
      },
    },
    {
      files: ['apps/mobile/**/*', 'apps/web/**/*'],
      env: { browser: true },
      extends: ['plugin:react-hooks/recommended'],
    },
    {
      files: ['server/**/*', '**/*.cjs', '**/*.config.js', 'apps/mobile/record-demo.js'],
      env: { node: true },
    },
  ],
};
