import fs from 'node:fs/promises';
import path from 'node:path';

import { fileExists } from '@technobuddha/library';

import { type Logger } from './logger.ts';
import { type Options } from './options.ts';

type CssModules = Partial<Options['cssModules'] & Pick<Options, 'logLevel'>>;

export async function readVSCodeSettings(
  file: string,
  _logger?: Logger,
): Promise<CssModules | undefined> {
  return fs
    .readFile(file, 'utf-8')
    .then(JSON.parse)
    .then(
      (settings: Record<string, unknown>) =>
        ({
          logLevel: settings['cmtd.logLevel'],
          scopeBehaviour: settings['cmtd.cssModules.scopeBehaviour'],
          globalModulePaths: settings['cmtd.cssModules.globalModulePaths'],
          exportGlobals: settings['cmtd.cssModules.exportGlobals'],
          generateScopedName: settings['cmtd.cssModules.generateScopedName'],
          hashPrefix: settings['cmtd.cssModules.hashPrefix'],
          localsConvention: settings['cmtd.cssModules.localsConvention'],
          dtsHeader: settings['cmtd.cssModules.dtsHeader'],
          dtsFooter: settings['cmtd.cssModules.dtsFooter'],
          generateDtsOnSave: settings['cmtd.cssModules.generateDtsOnSave'],
          modulePattern: settings['cmtd.cssModules.modulePattern'],
          extensions: settings['cmtd.cssModules.extensions'],
        }) as CssModules,
    )
    .catch(() => undefined);
}

export async function locateVSCodeConfigrationFile(root: string): Promise<string | undefined> {
  const vscodeConfigPath = path.resolve(root, '.vscode', 'settings.json');

  if (await fileExists(vscodeConfigPath)) {
    return vscodeConfigPath;
  }

  return undefined;
}
