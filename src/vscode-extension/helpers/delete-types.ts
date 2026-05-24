import path from 'node:path';

import { type Uri, workspace } from 'vscode';

import { config } from '../extension.ts';

export async function deleteTypes(uri: Uri): Promise<void> {
  const { options, logger } = config;
  logger.info(`deleteTypes(${uri.fsPath})`);

  if (options.cssModules.generateDtsOnSave && config.isCSS(uri)) {
    const { dir, name, ext } = path.parse(uri.fsPath);

    for (const file of [
      `${name}.d${ext}.ts`,
      `${name}${ext}.d.ts`,
      `${name}${ext}.map`,
      `${name}.d${ext}.ts.map`,
      `${name}${ext}.d.ts.map`,
    ]) {
      const generatedUri = uri.with({ path: path.join(dir, file) });
      try {
        await workspace.fs.delete(generatedUri).then(() => {
          logger.debug(`Deleted generated file: ${generatedUri.fsPath}`);
        });
      } catch {}
    }
  }
}
