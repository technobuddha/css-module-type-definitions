import fs from 'node:fs/promises';

import { generateTypes } from '../css-library/index.ts';

import { type FileIgnorer } from './file-ignorer.ts';
import { fileOperation } from './file-operation.ts';
import { type Optionator } from './optionator.ts';

type UpdateOptions = {
  optionator: Optionator;
  ignorer: FileIgnorer;
};

export async function update({ optionator, ignorer }: UpdateOptions): Promise<void> {
  const typedefs = new Set(
    await ignorer.findUnignoredFiles(`**/${optionator.globIsTypeDefinition}`),
  );

  await ignorer
    .findUnignoredFiles(`**/${optionator.globIsCssModule}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          generateTypes(file, { options: optionator.options, logger: optionator.logger }, typedefs),
        ),
      ),
    );

  for (const file of typedefs) {
    await fs.rm(file);
    optionator.logger.info(fileOperation(file, 'deleted'));
  }
}
