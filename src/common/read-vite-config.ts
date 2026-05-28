import path from 'node:path';

import { fileExists } from '@technobuddha/library';
import { type CSSModulesOptions, type ResolvedCSSOptions, type UserConfig } from 'vite';

import { type Logger } from './logger.ts';

export type ViteCss = Partial<
  Omit<ResolvedCSSOptions, 'modules' | 'lightningcss'> & {
    modules?: Omit<CSSModulesOptions, 'generateScopedName' | 'localsConvention'> & {
      generateScopedName?: Extract<CSSModulesOptions['generateScopedName'], string>;
      localsConvention?: Extract<CSSModulesOptions['localsConvention'], string>;
    };
  }
>;

export async function readViteConfig(logger: Logger): Promise<ViteCss | undefined> {
  for (const ext of ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts']) {
    const viteConfigPath = path.resolve(`./vite.config.${ext}`);
    if (await fileExists(viteConfigPath)) {
      return import(/* webpackIgnore: true */ viteConfigPath).then((viteConfig: UserConfig) => {
        logger.debug(`Vite: ${path.relative(process.cwd(), viteConfigPath)}`);
        const cssConfig = viteConfig?.css ?? {};
        if (cssConfig.modules === false) {
          delete cssConfig.modules;
        }
        if (typeof cssConfig.modules?.generateScopedName === 'function') {
          delete cssConfig.modules.generateScopedName;
        }
        if (typeof cssConfig?.modules?.localsConvention === 'function') {
          delete cssConfig.modules.localsConvention;
        }
        return cssConfig as ViteCss;
      });
    }
  }

  return undefined;
}
