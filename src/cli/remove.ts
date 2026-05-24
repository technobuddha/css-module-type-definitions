import fs from 'node:fs/promises';

import { type Ignore } from 'ignore';

import { fileOperation, type Logger } from '../common/index.ts';

import { findUnignoredFiles } from './helpers/index.ts';

export async function remove(glob: string, ig: Ignore, logger: Logger): Promise<void> {
  await findUnignoredFiles(glob, ig).then(async (files) =>
    Promise.all(
      files.map(async (file) =>
        fs.rm(file).then(() => logger.info(fileOperation(file, 'deleted'))),
      ),
    ),
  );
}
