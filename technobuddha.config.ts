import { defineConfig } from '@technobuddha/project/config';

export default defineConfig({
  package: {
    dependencies: ['sugarss'],
    devDependencies: ['webpack-cli', 'ts-loader', 'vite-plugin-inspect'],
  },
  git: {
    ignore: ['out'],
  },
  directories: {
    src: {
      platform: 'node',
    },
    scratch: {
      platform: 'vite-client',
    },
  },
  typedoc: {
    readme: 'doc/intro.md',
  },
  lint: {
    rules: {
      'unicorn/prefer-event-target': { rule: 'off' },
      'promise/prefer-catch': { rule: 'off' },
    },
  },
});
