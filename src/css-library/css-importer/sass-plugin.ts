import { empty } from '@technobuddha/library';
import { type Importer } from 'sass';
import { Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger } from '../../common/index.ts';
import { vscodeFileExists } from '../../vscode-extension/helpers/index.ts';

type Arguments = {
  readonly root: Uri;
  readonly logger: Logger;
};

export function sassPlugin({ root, logger }: Arguments): Importer<'async'>[] {
  return [
    {
      canonicalize: async (url) => {
        const uri = /^[a-zA-Z0-9+.\-]+:\/\//v.test(url) ? Uri.parse(url) : Uri.joinPath(root, url);
        if (uri.scheme.toLowerCase() === 'file') {
          const ext = Utils.extname(uri);

          const possibles: Uri[] = [];
          const basename = Utils.basename(uri);
          const dirname = Utils.dirname(uri).fsPath;

          for (const prefix of basename.startsWith('_') ? [empty] : [empty, '_']) {
            const possible = Uri.file(`${dirname}/${prefix}${basename}`);
            if (await vscodeFileExists(possible)) {
              possibles.push(possible);
            }

            if (ext === empty) {
              for (const suffix of [
                '.scss',
                '.sass',
                '.css',
                '/index.scss',
                '/index.sass',
                '/index.css',
              ]) {
                const possible = Uri.file(`${dirname}/${prefix}${basename}${suffix}`);
                if (await vscodeFileExists(possible)) {
                  possibles.push(possible);
                }
              }
            }
          }

          if (possibles.length === 1) {
            return new URL(possibles[0].toString(false));
          }

          logger.error(fileOperation(uri, 'error', `Could not resolve ${url} to a single file.`));
          return null;
        }

        return new URL(uri.toString(false));
      },
      load: async (canonicalUrl: URL) => {
        const uri = Uri.parse(canonicalUrl.href);
        const ext = Utils.extname(uri);
        const contents = await workspace.openTextDocument(uri).then(
          (doc) => doc.getText(),
          (error) => {
            logger.error(fileOperation(uri, 'error', error));
            return empty;
          },
        );
        const syntax =
          ext === '.scss' ? 'scss'
          : ext === '.sass' ? 'indented'
          : 'css';

        return { contents, syntax, sourceMapUrl: canonicalUrl };
      },
    },
  ];
}
