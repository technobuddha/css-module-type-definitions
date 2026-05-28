import fs from 'node:fs/promises';

import {
  fileOperation,
  generateTypes,
  type Ignorer,
  type Logger,
  type Options,
} from '../common/index.ts';

type UpdateOptions = {
  options: Options;
  logger: Logger;
  ignorer: Ignorer;
};

export async function update(
  globIsCss: string,
  globIsTypeDefinition: string,
  { options, logger, ignorer }: UpdateOptions,
): Promise<void> {
  const typedefs = new Set(await ignorer.findUnignoredFiles(`**/${globIsTypeDefinition}`));

  await ignorer
    .findUnignoredFiles(`**/${globIsCss}`)
    .then(async (files) =>
      Promise.all(files.map(async (file) => generateTypes(file, { options, logger }, typedefs))),
    );

  for (const file of typedefs) {
    await fs.rm(file);
    logger.info(fileOperation(file, 'deleted'));
  }
}
