import fs from 'node:fs/promises';
import path from 'node:path';

import { ResolvedConfig, type Plugin } from 'vite';

import { defaultOptions, type Options } from '../common/index.ts';
import { generateTypesFromCss } from '../css-library/generate-types-from-css.ts';

function updateOptions(current: Options, viteConfig: ResolvedConfig): Options {
  return {
    postcss: current.postcss,
    preprocessor: current.preprocessor,
    cssModules: { ...viteConfig.css.modules, ...current.cssModules },
  } as Options;
}

async function generateDeclarationFile(file: string, options: Options): Promise<void> {
  return fs
    .readFile(file, 'utf-8')
    .then(async (css) =>
      generateTypesFromCss(css, file, { options, logger: console }).then(async ({ files }) =>
        Promise.all(
          Object.entries(files).map(async ([filename, content]) =>
            fs.writeFile(filename, content, 'utf-8'),
          ),
        ).then(() => console.log(`{CMTD} Generated type definitions for ${file}`)),
      ),
    );
}

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
export const pluginCssModuleTypeDefinitions = (opts?: Partial<Options>): Plugin => {
  let options: Options = {
    postcss: { ...defaultOptions.postcss, ...opts?.postcss },
    preprocessor: { ...defaultOptions.preprocessor, ...opts?.preprocessor },
    cssModules: { ...defaultOptions.cssModules, ...opts?.cssModules },
  };

  return {
    name: 'css-module-type-definitions',
    apply: 'serve',
    async configureServer({ config }) {
      if (config.css.modules) {
        options = updateOptions(options, config);

        const globIsCss = `**/${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;
        const promises: Promise<void>[] = [];

        for await (const file of fs.glob(globIsCss)) {
          promises.push(generateDeclarationFile(file, options));
        }

        return Promise.all(promises).then(() => undefined);
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
    async handleHotUpdate({ file, server: { config } }) {
      if (config.css.modules) {
        options = updateOptions(options, config);
        const globIsCss = `${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;

        if (path.matchesGlob(file, globIsCss)) {
          return generateDeclarationFile(file, options);
        }
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
  };
};
