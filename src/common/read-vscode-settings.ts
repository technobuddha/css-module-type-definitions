import fs from 'node:fs/promises';

import { type Options } from './index.ts';

type CssModules = Partial<Options['cssModules']>;

export async function readVSCodeSettings(): Promise<CssModules> {
  return fs
    .readFile('.vscode/settings.json', 'utf-8')
    .then(JSON.parse)
    .then(
      (settings: Record<string, unknown>) =>
        ({
          scopeBehaviour: settings['cmtd.cssModules.scopeBehaviour'],
          globalModulePaths: settings['cmtd.cssModules.globalModulePaths'],
          exportGlobals: settings['cmtd.cssModules.exportGlobals'],
          generateScopedName: settings['cmtd.cssModules.generateScopedName'],
          hashPrefix: settings['cmtd.cssModules.hashPrefix'],
          localsConvention: settings['cmtd.cssModules.localsConvention'],
          dtsBanner: settings['cmtd.cssModules.dtsBanner'],
          dtsHeader: settings['cmtd.cssModules.dtsHeader'],
          dtsFooter: settings['cmtd.cssModules.dtsFooter'],
          generateDtsOnSave: settings['cmtd.cssModules.generateDtsOnSave'],
          modulePattern: settings['cmtd.cssModules.modulePattern'],
          extensions: settings['cmtd.cssModules.extensions'],
        }) as CssModules,
    )
    .catch(() => ({}));
}
