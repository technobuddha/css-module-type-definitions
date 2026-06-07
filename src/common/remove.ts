import fs from 'node:fs/promises';

import { type FileIgnorer, fileOperation, type Logger, type Optionator } from '../common/index.ts';

type RemoveOptions = {
  ignorer: FileIgnorer;
  optionator: Optionator;
  logger: Logger;
};

export async function remove({ ignorer, optionator, logger }: RemoveOptions): Promise<void> {
  await ignorer
    .findUnignoredFiles(`**/${optionator.globIsTypeDefinition}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          fs.rm(file).then(() => logger.info(fileOperation(file, 'deleted'))),
        ),
      ),
    );
}
