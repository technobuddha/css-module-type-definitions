import { defineConfig } from 'vite';
import inspect from 'vite-plugin-inspect';

import { pluginCssModuleTypeDefinitions } from './src/vite-plugin/vite-plugin.ts';

export default defineConfig({
  root: './scratch',
  server: {
    port: 3000,
  },
  devtools: true,
  plugins: [pluginCssModuleTypeDefinitions(), inspect()],
  css: {
    modules: {
      //localsConvention: 'camelCase',
      //generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
});
