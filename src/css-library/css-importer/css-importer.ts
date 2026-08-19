import { type FileImporter, type Importer } from 'sass';
import { type Uri } from 'vscode';

import { type Logger } from '../../common/index.ts';

import { cssPlugin } from './css-plugin.ts';
import { lessPlugin } from './less-plugin.ts';
import { sassPlugin } from './sass-plugin.ts';

export type CssImporter = {
  less: Less.Plugin;
  css: (filename: string) => Promise<string>;
  sass: (FileImporter<'async'> | Importer<'async'>)[];
};

type Arguments = {
  root: Uri;
  logger: Logger;
};

export function cssImporter({ root, logger }: Arguments): CssImporter {
  return {
    less: lessPlugin(root),
    css: cssPlugin(logger),
    sass: sassPlugin({ root, logger }),
  };
}
