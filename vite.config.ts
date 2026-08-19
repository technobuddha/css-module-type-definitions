import { defineConfig } from 'vite';
import inspect from 'vite-plugin-inspect';

export default defineConfig({
  root: './scratch',
  server: {
    port: 3000,
  },
  devtools: true,
  plugins: [inspect()],
  css: {
    modules: {
      exportGlobals: true,
      localsConvention: 'camelCase',
      generateScopedName: '[name]_[local]_[hash:base64:5]',
    },
  },
});
