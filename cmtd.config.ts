import { defineConfig } from './src/common/index.ts';

export default defineConfig({
  css: {
    generateDts: true,
    classesConvention: 'kebabCase',
  },
});
