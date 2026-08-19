import fs from 'node:fs/promises';

import { toError } from '@technobuddha/library';

import { fileOperation, type Logger } from './index.ts';

type WriteIfDifferentArguments = {
  file: string;
  content: string;
  logger: Logger;
};

export async function writeIfDifferent({
  file,
  content: newContent,
  logger,
}: WriteIfDifferentArguments): Promise<void> {
  return fs
    .readFile(file, 'utf-8')
    .then(async (oldContent) => {
      if (oldContent !== newContent) {
        return fs
          .writeFile(file, newContent, 'utf-8')
          .then(() => logger.info(fileOperation(file, 'updated')));
      }
    })
    .catch(async (e) => {
      const error = toError(e);
      if (error.code === 'FileNotFound') {
        await fs.writeFile(file, newContent, 'utf-8');
        logger.info(fileOperation(file, 'created'));
      } else {
        logger.error(fileOperation(file, 'error', error));
      }
    });
}
