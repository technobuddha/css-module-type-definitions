import { defineConfig } from 'vite';
import inspect from 'vite-plugin-inspect';

import { pluginCssModuleTypeDefinitions } from './src/vite-plugin/vite-plugin.ts';

export default defineConfig({
  server: {
    port: 3000,
  },
  devtools: true,
  plugins: [pluginCssModuleTypeDefinitions(), inspect()],
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
});
