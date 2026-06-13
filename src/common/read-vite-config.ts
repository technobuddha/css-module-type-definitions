import fs from 'node:fs/promises';
import path from 'node:path';

import { dynamicImport, fileExists, noop, toRelativePath } from '@technobuddha/library';
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

export async function readViteConfig(file: string, logger?: Logger): Promise<ViteCss | undefined> {
  const { ext, dir } = path.parse(file);
  const tmpname = path.resolve(path.join(dir, `vite${Date.now()}${Math.random()}.${ext}`));

  logger?.error(file);

  return fs
    .cp(file, tmpname, { force: true })
    .then(async () =>
      dynamicImport<UserConfig>(toRelativePath(tmpname)).then((viteConfig) => {
        if (viteConfig?.css?.modules) {
          logger?.trace(`Vite: ${JSON.stringify(viteConfig.css.modules)}`);
        }
        return transformViteConfig(viteConfig);
      }),
    )
    .finally(() => void fs.rm(tmpname, { force: true }).catch(noop));
}

export async function locateViteConfigurationFile(root: string): Promise<string | undefined> {
  for (const ext of ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts']) {
    const viteConfigPath = path.resolve(path.join(root, `vite.config.${ext}`));
    if (await fileExists(viteConfigPath)) {
      return viteConfigPath;
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
