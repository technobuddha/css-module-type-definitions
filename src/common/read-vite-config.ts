import path from 'node:path';

import { dynamicImport, fileExists, toRelativePath } from '@technobuddha/library';
import {
  type CSSModulesOptions,
  type ResolvedConfig,
  type ResolvedCSSOptions,
  type UserConfig,
} from 'vite';

import { type Logger } from './logger.ts';

export type ViteCss = Partial<
  Omit<ResolvedCSSOptions, 'modules' | 'lightningcss'> & {
    modules?: Omit<CSSModulesOptions, 'generateScopedName' | 'localsConvention'> & {
      generateScopedName?: Extract<CSSModulesOptions['generateScopedName'], string>;
      localsConvention?: Extract<CSSModulesOptions['localsConvention'], string>;
    };
  }
>;

export async function readViteConfig(root: string, logger?: Logger): Promise<ViteCss | undefined> {
  for (const ext of ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts']) {
    const viteConfigPath = toRelativePath(path.resolve(path.join(root, `vite.config.${ext}`)));
    if (await fileExists(viteConfigPath)) {
      return dynamicImport<UserConfig>(viteConfigPath).then((viteConfig) => {
        logger?.debug(`Vite: ${path.relative(root, viteConfigPath)}`);
        return transformViteConfig(viteConfig);
      });
    }
  }

  return undefined;
}

export function transformViteConfig(vite: UserConfig | ResolvedConfig): ViteCss {
  const cssConfig = vite?.css ?? {};
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
}
