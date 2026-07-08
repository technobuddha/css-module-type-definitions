import { empty, splitLines, unindent } from '@technobuddha/library';
import {
  type CancellationToken,
  type Hover,
  type HoverProvider,
  type Position,
  type TextDocument,
} from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

import { getClassInfo } from './helpers/get-class-info.ts';

export type CMTDHoverProviderOptions = {
  workspaceController: WorkspaceController;
};

export class CMTDHoverProvider implements HoverProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor({ workspaceController }: CMTDHoverProviderOptions) {
    this.#workspaceController = workspaceController;
  }

  public async provideHover(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Hover | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const clickInfo = await getClassInfo(document, position);
      if (clickInfo) {
        const { importUri, className } = clickInfo;

        const types = await folderController.getTypes(importUri);
        if (types) {
          const { classes } = types;

          const extracted = classes.get(className);
          if (extracted) {
            const md: string[] = [];
            let first = true;

            for (const { snippet } of extracted) {
              if (!first) {
                md.push('---', empty);
              }
              md.push('```css', ...splitLines(unindent(snippet)), '```', empty);
              first = false;
            }

            return { contents: [md.join('\n')] };
          }
        }
      }
    }
    return null;
  }
}
