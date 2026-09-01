import os from 'node:os';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import {
  type CancellationToken,
  CodeLens,
  type CodeLensProvider,
  commands,
  type Disposable,
  type Event,
  EventEmitter,
  Range,
  type TextDocument,
  Uri,
  window,
  workspace,
} from 'vscode';

import { type Logger } from '../../common/index.ts';

import { type WorkspaceController } from '../controllers/index.ts';

const COMMAND_NAME = 'cmtd.cssCodeLens';

class CssCodeLens extends CodeLens {
  public uri: Uri;
  public constructor(range: Range, uri: Uri) {
    super(range);
    this.uri = uri;
  }
}

export class CssCodeLensProvider implements CodeLensProvider<CssCodeLens>, Disposable {
  readonly #onDidChangeCodeLenses: EventEmitter<void> = new EventEmitter<void>();

  protected readonly disposables: Disposable[] = [];
  protected readonly workspaceController: WorkspaceController;

  public readonly onDidChangeCodeLenses: Event<void> = this.#onDidChangeCodeLenses.event;

  public constructor(workspaceController: WorkspaceController) {
    this.workspaceController = workspaceController;

    workspace.onDidChangeConfiguration((_) => {
      this.#onDidChangeCodeLenses.fire();
    });

    this.disposables.push(
      commands.registerCommand(COMMAND_NAME, (cssUri: Uri, importUris: Uri[]) => {
        if (importUris.length === 0) {
          return;
        }
        if (importUris.length === 1) {
          void workspace
            .openTextDocument(importUris[0])
            .then((doc) => window.showTextDocument(doc));
        }

        const fc = this.workspaceController.folderController(cssUri);
        const root = fc?.folder.uri ?? Uri.file(os.homedir());

        void window
          .showQuickPick(
            importUris.map((uri) => ({
              uri,
              label: path.relative(cssUri.fsPath, uri.fsPath),
              detail: path.relative(root.fsPath, uri.fsPath),
            })),
            {
              placeHolder: 'Select a file to open',
              prompt: fc?.folder.name,
            },
          )
          .then(async (pick) => {
            if (pick) {
              workspace.openTextDocument(pick.uri).then((doc) => window.showTextDocument(doc));
            }
          });
      }),
    );
  }

  public get logger(): Logger {
    return this.workspaceController.logger;
  }

  public provideCodeLenses(document: TextDocument, _token: CancellationToken): CssCodeLens[] {
    return [new CssCodeLens(new Range(0, 0, 0, 0), document.uri)];
  }

  public resolveCodeLens(codeLens: CssCodeLens, _token: CancellationToken): CssCodeLens | null {
    const fc = this.workspaceController.folderController(codeLens.uri);
    if (fc) {
      const command = fc.command(codeLens.uri);
      codeLens.command = {
        command: COMMAND_NAME,
        title: command?.title ? `${command?.icon ?? '$(cmtd-logo)'} ${command.title}` : empty,
        tooltip: command?.tooltip ?? empty,
        arguments: command?.arguments ?? [],
      };
    }

    return codeLens;
  }

  public refreshCodeLenses(): void {
    this.#onDidChangeCodeLenses.fire();
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
