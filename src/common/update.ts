import fs from 'node:fs/promises';

import {
  type FileIgnorer,
  fileOperation,
  generateTypes,
  type Logger,
  type Optionator,
} from './index.ts';

type UpdateOptions = {
  optionator: Optionator;
  logger: Logger;
  ignorer: FileIgnorer;
};

export async function update({ optionator, logger, ignorer }: UpdateOptions): Promise<void> {
  const typedefs = new Set(
    await ignorer.findUnignoredFiles(`**/${optionator.globIsTypeDefinition}`),
  );

  await ignorer
    .findUnignoredFiles(`**/${optionator.globIsCss}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) =>
          generateTypes(file, { options: optionator.options, logger }, typedefs),
        ),
      ),
    );

  for (const file of typedefs) {
    await fs.rm(file);
    logger.info(fileOperation(file, 'deleted'));
  }
}
