import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/experiment/index.ts',
      formats: ['cjs'],
      fileName: 'extension',
    },
    rollupOptions: {
      external: ['vscode'],
    },
    sourcemap: true,
    outDir: 'out',
  },
  plugins: [],
  css: {
    modules: {
      scopeBehaviour: 'local',
        generateScopedName: '[name]__[local]___[hash:base64:5]',
    }
  }
});
