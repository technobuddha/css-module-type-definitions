import { type Uri, workspace } from 'vscode';

import { type Logger, type Options } from '../../common/index.ts';
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
  logger.info(`generateTypes(${uri.fsPath})`);

  if (options.cssModules.generateDtsOnSave && config.isCSS(uri)) {
    return workspace.fs.stat(uri).then(async () =>
      workspace.fs
        .readFile(uri)
        .then(workspace.decode)
        .then(async (content) =>
          generateTypesFromCss(content, uri.path, {
            options,
            logger: config.logger,
          }).then(async ({ files }) =>
            Promise.all(
              Object.entries(files).map(async ([filename, content]) =>
                workspace.fs.writeFile(
                  uri.with({ path: filename }),
                  await workspace.encode(content),
                ),
              ),
            ).then(() => undefined),
          ),
        ),
    );
  }
}
