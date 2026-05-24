import { type Uri, workspace } from 'vscode';

import { generateTypesFromCss } from '../../css-library/index.ts';

import { config } from '../extension.ts';

export async function generateTypes(uri: Uri): Promise<void> {
  const { options, logger } = config;

  if (options.cssModules.generateDtsOnSave && config.isCSS(uri)) {
    logger.info(`generateTypes(${uri.fsPath})`);
    return workspace.fs.stat(uri).then(async () =>
      workspace.fs
        .readFile(uri)
        .then(workspace.decode)
        .then(async (content) =>
          generateTypesFromCss(content, uri.path, {
            options,
            logger,
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
