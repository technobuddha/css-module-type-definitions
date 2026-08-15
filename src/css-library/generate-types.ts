import fs from 'node:fs/promises';
import path from 'node:path';

import { fileOperation, type Logger, type Options } from '../common/index.ts';

import { generateTypesFromCss } from './generate-types-from-css.ts';

type GenerateTypesOptions = {
  options: Options;
  logger: Logger;
};

export async function generateTypes(
  file: string,
  { options, logger }: GenerateTypesOptions,
  typedefs?: Set<string>,
): Promise<void> {
  return fs
    .readFile(file, 'utf-8')
    .then(async (content) => {
      await generateTypesFromCss(content, file, { options, logger }).then(
        async ({ dtsFilename, dtsContents }) => {
          typedefs?.delete(path.relative('.', dtsFilename));

          await fs
            .readFile(dtsFilename, 'utf-8')
            .then(async (existingContent) => {
              if (existingContent !== dtsContents) {
                return fs
                  .writeFile(dtsFilename, dtsContents, 'utf-8')
                  .then(() => {
                    logger.info(fileOperation(dtsFilename, 'updated'));
                  })
                  .catch((error) => {
                    logger.error(error, ' <== from generateTypes I');
                  });
              }
            })
            .catch(async () =>
              fs
                .writeFile(dtsFilename, content, 'utf-8')
                .then(() => {
                  logger.info(fileOperation(dtsFilename, 'created'));
                })
                .catch((error) => {
                  logger.error(error, ' <== from generateTypes II');
                }),
            );
        },
      );
    })
    .catch((error) => {
      logger.error(
        `Error processing file ${file}: ${Error.isError(error) ? error : String(error)}`,
      );
    });
}
