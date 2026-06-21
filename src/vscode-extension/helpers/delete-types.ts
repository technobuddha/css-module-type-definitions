import path from 'node:path';

import { type Uri, workspace } from 'vscode';

import { fileOperation, type Logger } from '../../common/index.ts';

type DeleteTypesOptions = {
  logger: Logger;
};

export async function deleteTypes(uri: Uri, { logger }: DeleteTypesOptions): Promise<void> {
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
        logger.debug(fileOperation(generatedUri.fsPath, 'deleted'));
      });
    } catch {}
  }
}
