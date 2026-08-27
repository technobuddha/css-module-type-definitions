import { empty } from '@technobuddha/library';
import { workspace } from 'vscode';

import { fileOperation, type Logger } from '../../common/index.ts';

export function cssPlugin(logger: Logger): (filename: string) => Promise<string> {
  return async (filename: string) =>
    workspace.openTextDocument(filename).then(
      (doc) => doc.getText(),
      (error) => {
        logger.error(fileOperation(filename, 'error', error));
        return empty;
      },
    );
}
