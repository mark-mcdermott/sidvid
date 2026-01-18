import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/lib/sidvid/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  outDir: 'dist',
});
