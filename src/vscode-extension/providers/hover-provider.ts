import { empty } from '@technobuddha/library';
import {
  type CancellationToken,
  type Hover,
  type HoverProvider,
  type Position,
  type TextDocument,
  workspace,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { type Logger, type LoggerController, type OptionsController } from '../../common/index.ts';
import { generateTypesFromCss } from '../../css-library/generate-types-from-css.ts';

import { TSExtractor } from './extractors/index.ts';

export type CMTDHoverProviderOptions = {
  logger: LoggerController;
  options: OptionsController;
};

export class CMTDHoverProvider implements HoverProvider {
  readonly #options: OptionsController;

  readonly #logger: LoggerController;

  public constructor({ options, logger }: CMTDHoverProviderOptions) {
    this.#options = options;
    this.#logger = logger;
  }

  private get logger(): Logger {
    return this.#logger.logger;
  }

  public async provideHover(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Hover | null> {
    const folder = workspace.getWorkspaceFolder(document.uri);
    if (folder) {
      const tse = new TSExtractor(document, position);

      const clickInfo = await tse.getClickInfo();
      if (clickInfo) {
        const { importUri, className } = clickInfo;

        const content = await workspace.fs.readFile(importUri).then(workspace.decode);
        const language = Utils.extname(importUri).replace('.', empty);

        const { classes } = await generateTypesFromCss(content, importUri.fsPath, {
          options: this.#options.options(folder),
          logger: this.logger,
        });
        const extracted = classes.get(className);
        if (extracted) {
          return {
            contents: [`\`\`\`${language}\n${extracted.css}\n\`\`\``],
          };
        }
      }
    }
    return null;
  }
}
