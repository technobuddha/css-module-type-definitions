import fs from 'node:fs/promises';

import { type Ignore } from 'ignore';

import { type Logger, type Options } from '../common/index.ts';

import { fileOperation, findUnignoredFiles, generateTypes } from './helpers/index.ts';

type UpdateOptions = {
  options: Options;
  logger: Logger;
  ig: Ignore;
};

export async function update(
  globIsCss: string,
  globIsTypeDefinition: string,
  { options, logger, ig }: UpdateOptions,
): Promise<void> {
  const typedefs = new Set(await findUnignoredFiles(globIsTypeDefinition, ig));

  await findUnignoredFiles(globIsCss, ig).then(async (files) =>
    Promise.all(files.map(async (file) => generateTypes(file, { options, logger }, typedefs))),
  );

  for (const file of typedefs) {
    await fs.rm(file);
    logger.info(fileOperation(file, 'deleted'));
  }
}
