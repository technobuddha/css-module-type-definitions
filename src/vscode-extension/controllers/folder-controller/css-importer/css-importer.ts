import { empty } from '@technobuddha/library';
import { Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { type CssImporter } from '../../../../css-library/index.ts';
import { fileOperation, type Logger } from '../../../../index.ts';

import { fileExists } from '../../../helpers/file-exists.ts';

import { LessPluginVscode } from './less-plugin-vscode.ts';

type Arguments = {
  root: Uri;
  logger: Logger;
};

export function cssImporter({ root, logger }: Arguments): CssImporter {
  return {
    less: new LessPluginVscode(root),
    css: async (filename: string): Promise<string> =>
      workspace.openTextDocument(filename).then(
        (doc) => doc.getText(),
        (error) => {
          logger.error(fileOperation(filename, 'error', error));
          return empty;
        },
      ),
    sass: [
      {
        canonicalize: async (url) => {
          const uri =
            /^[a-zA-Z0-9+.\-]+:\/\//v.test(url) ? Uri.parse(url) : Uri.joinPath(root, url);
          if (uri.scheme.toLowerCase() === 'file') {
            const ext = Utils.extname(uri);

            const possibles: Uri[] = [];
            const basename = Utils.basename(uri);
            const dirname = Utils.dirname(uri).fsPath;

            for (const prefix of basename.startsWith('_') ? [empty] : [empty, '_']) {
              const possible = Uri.file(`${dirname}/${prefix}${basename}`);
              if (await fileExists(possible)) {
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
                  if (await fileExists(possible)) {
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
    ],
  };
}
