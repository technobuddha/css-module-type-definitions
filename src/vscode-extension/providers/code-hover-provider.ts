import { empty, splitLines, unindent } from '@technobuddha/library';
import {
  type CancellationToken,
  type Hover,
  type HoverProvider,
  type Position,
  type TextDocument,
} from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';
import { getLocalInfo } from '../helpers/index.ts';

export type Arguments = {
  workspaceController: WorkspaceController;
};

export class CodeHoverProvider implements HoverProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor({ workspaceController }: Arguments) {
    this.#workspaceController = workspaceController;
  }

  public async provideHover(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Hover | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { importUri, localName } = localInfo;

        const cssInfo = await folderController.cssInformationForFile(importUri);
        if (cssInfo) {
          const { locationsOfClass: classLocations } = cssInfo;

          const extracted = classLocations.get(localName);
          if (extracted) {
            const md: string[] = [];
            let first = true;

            for (const snippet of new Set(extracted.map((e) => e.snippet))) {
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
