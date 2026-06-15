import fs from 'node:fs/promises';

import { type FileIgnorer, fileOperation, generateTypes, type Optionator } from './index.ts';

type UpdateOptions = {
  optionator: Optionator;
  ignorer: FileIgnorer;
};

export async function update({ optionator, ignorer }: UpdateOptions): Promise<void> {
  optionator.logger.info(optionator.globIsCss);
  optionator.logger.info(optionator.globIsTypeDefinition);

  const typedefs = new Set(
    await ignorer.findUnignoredFiles(`**/${optionator.globIsTypeDefinition}`),
  );

  await ignorer
    .findUnignoredFiles(`**/${optionator.globIsCss}`)
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
