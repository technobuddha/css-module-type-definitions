import fs from 'node:fs/promises';
import path from 'node:path';

import { fileOperation, type Logger, type NormalizedOptions } from '../common/index.ts';

import { generateTypesFromCss } from './index.ts';

type GenerateTypesOptions = {
  options: NormalizedOptions;
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
      await generateTypesFromCss(content, file, { options, logger }).then(async ({ files }) => {
        for (const [filename, content] of Object.entries(files)) {
          typedefs?.delete(path.relative('.', filename));

          await fs
            .readFile(filename, 'utf-8')
            .then(async (existingContent) => {
              if (existingContent !== content) {
                return fs
                  .writeFile(filename, content, 'utf-8')
                  .then(() => {
                    logger.info(fileOperation(filename, 'updated'));
                  })
                  .catch((error) => {
                    logger.error(error);
                  });
              }
            })
            .catch(async () =>
              fs
                .writeFile(filename, content, 'utf-8')
                .then(() => {
                  logger.info(fileOperation(filename, 'created'));
                })
                .catch((error) => {
                  logger.error(error);
                }),
            );
        }
      });
    })
    .catch((error) => {
      logger.error(
        `Error processing file ${file}: ${Error.isError(error) ? error : String(error)}`,
      );
    });
}
