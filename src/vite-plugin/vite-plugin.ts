import { type Plugin } from 'vite';

import { defaultLogger, FileIgnorer, Optionator, type Options, watch } from '../common/index.ts';

/**
 * Vite plugin that automatically generates TypeScript type definition files for CSS modules.
 *
 * This plugin integrates with Vite's development server to:
 * - Scan for CSS module files on server startup
 * - Generate corresponding `.d.ts` files with exported class name types
 * - Update type definitions automatically when CSS module files change via HMR
 *
 * @param opts - Configuration options for CSS module type definition generation
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
export const pluginCssModuleTypeDefinitions = async (opts?: Partial<Options>): Promise<Plugin> => {
  const ignorer = new FileIgnorer('.', { watch: false, logger: defaultLogger });
  let optionator: Optionator;

  return {
    name: 'css-module-type-definitions',
    apply: 'serve',
    async configureServer({ config }) {
      if (config.css.modules) {
        optionator = await Optionator.create(opts, {
          watch: false,
          logger: defaultLogger,
          vite: config,
        });

        void watch({ optionator, ignorer, logger: defaultLogger });
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
  };
};
