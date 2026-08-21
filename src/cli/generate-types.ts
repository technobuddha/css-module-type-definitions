import fs from 'node:fs/promises';
import path from 'node:path';

import { fileOperation, type Logger, type Options } from '../common/index.ts';
import { generateCssInfo } from '../css-library/index.ts';

type GenerateTypesOptions = {
  readonly options: Options;
  readonly root: string;
  readonly logger: Logger;
};

export async function generateTypes(
  file: string,
  { options, root, logger }: GenerateTypesOptions,
  typedefs?: Set<string>,
): Promise<void> {
  return fs
    .readFile(file, 'utf-8')
    .then(async (content) => {
      await generateCssInfo(content, file, { options, logger, relativeTo: root, root })
        .then(async ({ dtsFilename, dtsContents }) => {
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
                    logger.error(fileOperation(dtsFilename, 'error', error));
                  });
              }
            })
            .catch(async () =>
              fs
                .writeFile(dtsFilename, dtsContents, 'utf-8')
                .then(() => {
                  logger.info(fileOperation(dtsFilename, 'created'));
                })
                .catch((error) => {
                  logger.error(fileOperation(dtsFilename, 'error', error));
                }),
            );
        })
        .catch((error) => {
          logger.error(
            `Error processing file ${file}: ${Error.isError(error) ? error : String(error)}`,
          );
        });
    })
    .catch((error) => {
      logger.error(`Error Reading file ${file}: ${Error.isError(error) ? error : String(error)}`);
    });
}
