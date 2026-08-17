import path from 'node:path';

import { fileExists } from '@technobuddha/library';

import { CONFIG_EXTENSIONS } from './constants.ts';
import { type Options } from './options.ts';
import { reImport } from './reimport.ts';

export async function readCMTDConfig(file: string): Promise<Options | undefined> {
  return reImport<Options>(file).catch(() => undefined);
}

export async function locateCMTDConfigurationFile(root: string): Promise<string | undefined> {
  for (const ext of CONFIG_EXTENSIONS) {
    const cmtdConfigPath = path.resolve(path.join(root, `cmtd.config${ext}`));
    if (await fileExists(cmtdConfigPath)) {
      return cmtdConfigPath;
    }
  }

  return undefined;
}
