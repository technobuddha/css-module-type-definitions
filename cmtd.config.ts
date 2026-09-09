import { defineConfig } from './src/config/index.ts';

export default defineConfig({
  css: {
    generateDts: true,
    classesConvention: 'kebabCase',
    modules: {
      localsConvention: 'camelCase',
      exportGlobals: true,
    },
  },
});
