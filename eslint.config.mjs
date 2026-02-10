import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-plugin-prettier/recommended';

export default defineConfig({
  extends: [...tseslint.configs.recommended, prettier],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
});
