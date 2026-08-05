import fs from 'node:fs/promises';

import { type FileIgnorer } from './file-ignorer.ts';
import { fileOperation } from './file-operation.ts';
import { type Optionator } from './optionator.ts';

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
