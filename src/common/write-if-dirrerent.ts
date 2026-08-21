import fs from 'node:fs/promises';

import { toError } from '@technobuddha/library';

import { fileOperation, type Logger } from './index.ts';

type WriteIfDifferentArguments = {
  readonly file: string;
  readonly content: string;
  readonly logger: Logger;
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
        logger.info(fileOperation(file, 'updated'));

        return fs.writeFile(file, newContent, 'utf-8');
      }
    })
    .catch(async (e) => {
      const error = toError(e);
      if (error.code === 'ENOENT') {
        logger.info(fileOperation(file, 'created'));
        await fs.writeFile(file, newContent, 'utf-8');
      } else {
        logger.error(fileOperation(file, 'error', error));
      }
    });
}
