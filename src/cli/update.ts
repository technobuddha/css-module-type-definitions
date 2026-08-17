import fs from 'node:fs/promises';

import {
  fileOperation,
  globIsCssModule,
  globIsCssTypeDefinition,
  type Logger,
  type Options,
} from '../common/index.ts';

import { generateTypes } from './generate-types.ts';
import { type Ignorer } from './ignorer.ts';

type UpdateArguments = {
  logger: Logger;
  root: string;
  options: Options;
  ignorer: Ignorer;
};

export async function update({ logger, root, options, ignorer }: UpdateArguments): Promise<void> {
  const typedefs = new Set(await ignorer.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`));

  await ignorer
    .findUnignoredFiles(`**/${globIsCssModule()}`)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) => generateTypes(file, { options, root, logger }, typedefs)),
      ),
    );

  for (const file of typedefs) {
    await fs.rm(file);
    logger.info(fileOperation(file, 'deleted'));
  }
}
