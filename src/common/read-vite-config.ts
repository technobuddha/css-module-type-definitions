import path from 'node:path';

import { fileExists, liveImport } from '@technobuddha/library';
import {
  type CSSModulesOptions,
  type ResolvedConfig,
  type ResolvedCSSOptions,
  type UserConfig,
} from 'vite';

import { CONFIG_EXTENSIONS } from './extensions.ts';

export type ViteCss = Partial<
  Omit<ResolvedCSSOptions, 'modules' | 'lightningcss'> & { readonly modules?: CSSModulesOptions }
>;

export async function readViteConfig(file: string): Promise<ViteCss | undefined> {
  return liveImport<UserConfig>(file)
    .then(transformViteConfig)
    .catch(() => undefined);
}

export async function locateViteConfigurationFile(root: string): Promise<string | undefined> {
  for (const ext of CONFIG_EXTENSIONS) {
    const viteConfigPath = path.resolve(path.join(root, `vite.config${ext}`));
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
  return cssConfig as ViteCss;
}
