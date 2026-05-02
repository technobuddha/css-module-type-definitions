import { type Plugin } from 'vite';

import { type CMTDOptions } from './cmtd-options.ts';
import { findCssModules } from './find-css-modules.ts';
import { generateDeclarationFile } from './generate-declaration-file.ts';

/**
 * Vite plugin that automatically generates TypeScript type definition files for CSS modules.
 *
 * This plugin integrates with Vite's development server to:
 * - Scan for CSS module files on server startup
 * - Generate corresponding `.d.ts` files with exported class name types
 * - Update type definitions automatically when CSS module files change via HMR
 *
 * @param options - Configuration options for CSS module type definition generation
 * @returns A Vite plugin instance
 *
 * @throws When `css.modules` is not enabled in the Vite configuration
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { pluginCssModuleTypeDefinitions } from 'css-module-type-definitions';
 *
 * export default defineConfig({
 *   css: {
 *     modules: {
 *       localsConvention: 'camelCase'
 *     }
 *   },
 *   plugins: [
 *     pluginCssModuleTypeDefinitions({
 *       extension: 'module.css',
 *       localsConvention: 'camelCase'
 *     })
 *   ]
 * });
 * ```
 *
 * @group Vite
 * @category Plugin
 */
export const pluginCssModuleTypeDefinitions = (options: CMTDOptions = {}): Plugin => {
  const opts = { ...options };
  opts.extension = opts.extension ?? 'module.css';

  return {
    name: 'css-module-type-definitions',
    apply: 'serve',
    configureServer(vds) {
      if (vds.config.css.modules) {
        opts.localsConvention =
          opts.localsConvention ?? vds.config.css.modules.localsConvention ?? 'camelCase';

        void findCssModules(opts);
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
    handleHotUpdate({ file, server: { config } }) {
      if (config.css.modules) {
        if (file.endsWith(`.${opts.extension}`)) {
          void generateDeclarationFile(file, opts);
        }
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
  };
};
