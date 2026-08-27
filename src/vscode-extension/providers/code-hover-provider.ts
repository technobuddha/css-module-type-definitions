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
import { type CssModuleInformation } from '../information/index.ts';

export type Arguments = {
  readonly workspaceController: WorkspaceController;
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

        const cssInfo = folderController.cssInformation(importUri) as CssModuleInformation;
        if (cssInfo) {
          const { locationsOfClass, localClass, hasDts } = cssInfo;
          const md: string[] = [];

          const classNames = localClass.get(localName);
          if (classNames) {
            for (const className of classNames) {
              const extracted = locationsOfClass.get(className);
              if (extracted) {
                for (const snippet of new Set(extracted.map((e) => e.snippet))) {
                  if (md.length > 0) {
                    md.push('---', empty);
                  }
                  md.push('```css', ...splitLines(unindent(snippet)), '```', empty);
                }
              }
              if (!hasDts) {
                if (md.length > 0) {
                  md.push('---', empty);
                }
                md.push(
                  '```typescript',
                  `(property) "${localName}": "${cssInfo.classScope[className]}"`,
                  '```',
                  empty,
                );
              }
            }

            return { contents: [md.join('\n')] };
          }
        }
      }
    }
    return null;
  }
}
