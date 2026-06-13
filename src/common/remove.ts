import fs from 'node:fs/promises';

import { type FileIgnorer, fileOperation, type Optionator } from './index.ts';

type RemoveOptions = {
  ignorer: FileIgnorer;
  optionator: Optionator;
};

export async function remove({ ignorer, optionator }: RemoveOptions): Promise<void> {
  await ignorer
    .findUnignoredFiles(`**/${optionator.globIsTypeDefinition}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          fs.rm(file).then(() => optionator.logger.info(fileOperation(file, 'deleted'))),
        ),
      ),
    );
}
