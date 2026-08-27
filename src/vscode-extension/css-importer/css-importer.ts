import { type URI as Uri } from 'vscode-uri';

import { type Logger } from '../../common/index.ts';
import { type CssImporter } from '../../css-library/css-importer.ts';

import { cssPlugin } from './css-plugin.ts';
import { lessPlugin } from './less-plugin.ts';
import { sassPlugin } from './sass-plugin.ts';

type Arguments = {
  readonly root: Uri;
  readonly logger: Logger;
};

export function cssImporter({ root, logger }: Arguments): CssImporter {
  return {
    less: lessPlugin(root),
    css: cssPlugin(logger),
    sass: sassPlugin({ root, logger }),
  };
}
