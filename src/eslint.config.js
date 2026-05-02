// 🚨
// 🚨 CHANGES TO THIS FILE WILL BE OVERRIDDEN
// 🚨
// @ts-check
import { lint } from '@technobuddha/project';

export default lint({
  files: ['**/*.ts'],
  ignores: ['__tests__/**/*', '@types/**/*', 'css-library/__tests__/**/*'],
  platform: 'node',
  typescript: true,
});
