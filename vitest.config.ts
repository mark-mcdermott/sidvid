import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '$lib': resolve(__dirname, './src/lib'),
      '$env': resolve(__dirname, './src/env')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
});
