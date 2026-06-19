import path from 'node:path';

import { type Uri, workspace } from 'vscode';

import { fileOperation } from '../../common/file-operation.ts';

import { config } from '../controllers/configuration-controller.ts';

export async function deleteTypes(uri: Uri): Promise<void> {
  const folder = workspace.getWorkspaceFolder(uri);
  if (folder) {
    const options = config.options(folder);
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
            config.logger.debug(fileOperation(generatedUri.fsPath, 'deleted'));
          });
        } catch {}
      }
    }
  } else {
    config.logger.error(`No workspace folder found for file: ${uri.fsPath}`);
  }
}
