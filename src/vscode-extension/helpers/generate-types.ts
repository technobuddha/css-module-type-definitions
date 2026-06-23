import { toError } from '@technobuddha/library';
import { type Uri, workspace } from 'vscode';

import { fileOperation, type Logger, type NormalizedOptions } from '../../common/index.ts';
import { generateTypesFromCss } from '../../css-library/index.ts';

type GenerateTypesOptions = {
  options: NormalizedOptions;
  logger: Logger;
};

export async function generateTypes(
  uri: Uri,
  { options, logger }: GenerateTypesOptions,
): Promise<void> {
  try {
    return await workspace.fs
      .readFile(uri)
      .then(workspace.decode)
      .then(async (content) =>
        generateTypesFromCss(content, uri.fsPath, { options, logger }).then(async ({ files }) =>
          Promise.all(
            Object.entries(files).map(async ([filename, content]) => {
              const fileUri = uri.with({ path: filename });

              try {
                await workspace.fs
                  .readFile(fileUri)
                  .then(workspace.decode)
                  .then(async (existingContent) => {
                    if (existingContent !== content) {
                      await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                      logger.info(fileOperation(filename, 'updated'));
                    }
                  });
              } catch {
                await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                logger.info(fileOperation(filename, 'created'));
              }
            }),
          ).then(() => undefined),
        ),
      );
  } catch (error) {
    logger.error(toError(error));
  }
}
