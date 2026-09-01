import { empty, isJsVariable } from '@technobuddha/library';
import {
  type CancellationToken,
  type CompletionContext,
  CompletionItem,
  CompletionItemKind,
  type CompletionItemProvider,
  CompletionList,
  CompletionTriggerKind,
  Position,
  Range,
  type TextDocument,
  TextEdit,
} from 'vscode';

import { isCssModule } from '../../common/index.ts';

import { type WorkspaceController } from '../controllers/index.ts';
import { getImportInfo } from '../helpers/index.ts';
import { type CssModuleInformation } from '../information/index.ts';

type Arguments = {
  readonly workspaceController: WorkspaceController;
};

export class CodeCompletionItemProvider implements CompletionItemProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor({ workspaceController }: Arguments) {
    this.#workspaceController = workspaceController;
  }

  public async provideCompletionItems(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    { triggerKind, triggerCharacter }: CompletionContext,
  ): Promise<CompletionItem[] | CompletionList | null | undefined> {
    if (triggerKind === CompletionTriggerKind.TriggerCharacter && !token.isCancellationRequested) {
      const fc = this.#workspaceController.folderController(document.uri);
      if (fc) {
        const importInfo = await getImportInfo(document, position);
        if (importInfo) {
          const { importUri } = importInfo;

          if (isCssModule(importUri)) {
            const cssInfo = fc.cssInformation<CssModuleInformation>(importUri);
            if (cssInfo && !cssInfo.hasDts) {
              const { classNamesOfLocalName } = cssInfo;

              return new CompletionList(
                Array.from(classNamesOfLocalName.keys(), (key) =>
                  toCompletionItem(key, triggerCharacter, position),
                ),
              );
            }
          }
        }
      }
    }
    return null;
  }
}

function toCompletionItem(
  label: string,
  triggerCharacter: string | undefined,
  position: Position,
): CompletionItem {
  const completionItem = new CompletionItem(label, CompletionItemKind.Property);

  if (triggerCharacter) {
    switch (triggerCharacter) {
      case '[': {
        completionItem.insertText = `'${label}']`;
        break;
      }

      case '.': {
        if (isJsVariable(label)) {
          completionItem.insertText = label;
        } else {
          completionItem.insertText = `['${label}']`;
          completionItem.additionalTextEdits = [
            new TextEdit(
              new Range(
                new Position(position.line, position.character - 1),
                new Position(position.line, position.character),
              ),
              empty,
            ),
          ];
        }
        break;
      }

      // no default
    }
  } else {
    completionItem.insertText = label;
  }
  return completionItem;
}
