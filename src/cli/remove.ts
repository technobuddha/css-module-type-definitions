import fs from 'node:fs/promises';

import { fileOperation, globIsCssTypeDefinition } from '../common/index.ts';

import { type Ignorer } from './ignorer.ts';
import { type Optionator } from './optionator.ts';

type RemoveOptions = {
  readonly ignorer: Ignorer;
  readonly optionator: Optionator;
};

export async function remove({ ignorer, optionator }: RemoveOptions): Promise<void> {
  await ignorer
    .findUnignoredFiles(`**/${globIsCssTypeDefinition()}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          fs.rm(file).then(() => optionator.logger.info(fileOperation(file, 'deleted'))),
        ),
      ),
    );
}
