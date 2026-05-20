import path from 'node:path';

import { empty, toError } from '@technobuddha/library';
import { type Uri, window, workspace } from 'vscode';

import { generateTypesFromCss } from '../../css-library/index.ts';
import { config } from '../extension.ts';

export async function generateTypes(uri: Uri): Promise<void> {
  const { options, logger } = config;

  if (options.cssModules.generateDtsOnSave && config.isCSS(uri)) {
    logger.log(`generateTypes(${uri.fsPath})`);
    return workspace.fs.stat(uri).then(async () => {
      const file = uri.fsPath;
      const { dir } = path.parse(file);

      return workspace.fs.readFile(uri).then(async (buffer) =>
        generateTypesFromCss(await workspace.decode(buffer), file, { options, logger }).then(
          async ({ dts, dtsFile, map }) => {
            const mapFile = `${dtsFile}.map`;

            // const comment = `//# sourceMappingURL=data:application/json;charset=utf-8;base64`;
            // const b64SourceMap = Buffer.from(JSON.stringify(map)).toString('base64');
            const comment = `//# sourceMappingURL=${path.basename(mapFile)}`;

            dts.push(comment, empty);

            try {
              await workspace.fs
                .writeFile(
                  uri.with({ path: path.join(dir, dtsFile) }),
                  new TextEncoder().encode(dts.join('\n')),
                )
                .then(() =>
                  workspace.fs.writeFile(
                    uri.with({ path: path.join(dir, mapFile) }),
                    new TextEncoder().encode(JSON.stringify(map)),
                  ),
                );
            } catch (error) {
              const message = `Failed to write type definitions for ${path.basename(file)}: ${toError(error).message}`;

              logger.error(message);
              window.showErrorMessage(message);
            }
          },
        ),
      );
    });
  }
}
