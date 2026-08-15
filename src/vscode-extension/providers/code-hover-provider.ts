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

  // ---- @types  dts syntax  case   type                          content
  // TODO with    yes .xxxxx  as-is  (property) scoped             none
  // TODO with    yes .xxxxx  camel  (property) scoped             none
  // TODO with    yes ['xx']  as-is  (property) scoped             none
  // TODO with    yes ['xx']  camel  (property) scoped             none
  // TODO with    no  .xxxxx  as-is  (index) CSSModuleClasses      none
  // TODO with    no  .xxxxx  camel  (index) CSSModuleClasses      none
  // TODO with    no  ['xx']  as-is  none                          none
  // TODO with    no  ['xx']  camel  none                          none
  // TODO without yes .xxxxx  as-is  (property) scoped             ok
  // TODO without yes .xxxxx  camel  (property) scoped             none
  // TODO without yes ['xx']  as-is  (property) scoped             ok
  // TODO without yes ['xx']  camel  (property) scoped             none
  // TODO without no  .xxxxx  as-is  any                           none
  // TODO without no  .xxxxx  camel  any                           none
  // TODO without no  ['xx']  as-is  none                          none
  // TODO without no  ['xx']  camel  none                          none

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

        const cssInfo = await folderController.cssInformation(importUri);
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
