import fs from 'node:fs/promises';

import { fileOperation, type Ignorer, type Logger } from '../common/index.ts';

export async function remove(glob: string, ignorer: Ignorer, logger: Logger): Promise<void> {
  await ignorer
    .findUnignoredFiles(`**/${glob}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          fs.rm(file).then(() => logger.info(fileOperation(file, 'deleted'))),
        ),
      ),
    );
}
