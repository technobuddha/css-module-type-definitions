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

import { TSExtractor } from './helpers/ts-extractor.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CMTDSelectorsCompletionProvider implements CompletionItemProvider {
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
    if (triggerKind !== CompletionTriggerKind.TriggerCharacter || token.isCancellationRequested) {
      return;
    }

    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController && !folderController.options.cssModules.generateDts) {
      const tse = new TSExtractor(document, position);

      const importInfo = await tse.getImportInfo();
      if (importInfo) {
        const { importUri } = importInfo;

        const types = await folderController.getTypes(importUri);
        if (types) {
          const { classes } = types;

          return new CompletionList(
            Array.from(classes.keys(), (key) =>
              toCompletionItem(key, triggerKind, triggerCharacter, position),
            ),
          );
        }
      }
    }
    return null;
  }
}

function toCompletionItem(
  label: string,
  triggerKind: CompletionTriggerKind,
  triggerCharacter: string | undefined,
  position: Position,
): CompletionItem {
  const completionItem = new CompletionItem(label, CompletionItemKind.Keyword);
  if (triggerKind === CompletionTriggerKind.TriggerCharacter && triggerCharacter) {
    switch (triggerCharacter) {
      case '[': {
        completionItem.insertText = `'${label}']`;
        break;
      }

      case '.': {
        completionItem.additionalTextEdits = [
          new TextEdit(
            new Range(
              new Position(position.line, position.character - 1),
              new Position(position.line, position.character),
            ),
            empty,
          ),
        ];
        completionItem.insertText = isJsVariable(label) ? `.${label}` : `['${label}']`;
        break;
      }

      // no default
    }
  } else {
    completionItem.insertText = label;
  }
  return completionItem;
}
