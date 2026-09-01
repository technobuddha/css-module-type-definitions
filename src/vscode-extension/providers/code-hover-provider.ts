import { unindent } from '@technobuddha/library';
import {
  type CancellationToken,
  Hover,
  type HoverProvider,
  MarkdownString,
  type Position,
  type TextDocument,
} from 'vscode';

import { isCssModule } from '../../common/index.ts';

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

        if (isCssModule(importUri)) {
          const cssInfo = folderController.cssInformation<CssModuleInformation>(importUri);
          if (cssInfo) {
            const { hasDts } = cssInfo;
            const locations = cssInfo.cssLocations({ importUri, localName });

            if (locations) {
              const md = new MarkdownString();
              const scopes: Set<string> = new Set();

              for (const { snippet, className } of locations) {
                md.appendCodeblock(unindent(snippet), 'css');

                const scope = cssInfo.scopeNameOfClassName.get(className);
                if (scope) {
                  scopes.add(scope);
                }
              }
              if (!hasDts) {
                const [scope] = scopes;
                md.appendCodeblock(`(property) "${localName}": "${scope}"`, 'typescript');
              }

              return new Hover(md.value);
            }
          }
        }
      }
    }
    return null;
  }
}
