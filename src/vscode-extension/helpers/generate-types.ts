import { type Uri, workspace } from 'vscode';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import { generateTypesFromCss } from '../../css-library/index.ts';

import { config } from '../controllers/configuration-controller.ts';

type GenerateTypesOptions = {
  options: Options;
  logger: Logger;
};

export async function generateTypes(
  uri: Uri,
  { options, logger }: GenerateTypesOptions,
): Promise<void> {
  if (options.cssModules.generateDtsOnSave && config.isCSS(uri)) {
    return workspace.fs.stat(uri).then(async () =>
      workspace.fs
        .readFile(uri)
        .then(workspace.decode)
        .then(async (content) =>
          generateTypesFromCss(content, uri.fsPath, {
            options,
            logger: config.logger,
          }).then(async ({ files }) =>
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
        ),
    );
  }
}
