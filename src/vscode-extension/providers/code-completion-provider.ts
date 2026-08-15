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

import { type WorkspaceController } from '../controllers/index.ts';
import { getImportInfo } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

// TODO not providing camel-cased completion items

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
      const folderController = this.#workspaceController.folderController(document.uri);
      if (folderController && !folderController.options.css.generateDts) {
        const importInfo = await getImportInfo(document, position);
        if (importInfo) {
          const { importUri } = importInfo;

          const cssInfo = await folderController.cssInformation(importUri);
          if (cssInfo) {
            const { localClass } = cssInfo;

            return new CompletionList(
              Array.from(localClass.keys(), (key) =>
                toCompletionItem(key, triggerCharacter, position),
              ),
            );
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
