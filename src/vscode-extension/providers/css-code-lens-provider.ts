import os from 'node:os';
import path from 'node:path';

import { conjoin, empty, nbsp } from '@technobuddha/library';
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
import { Utils } from 'vscode-uri';

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
      commands.registerCommand(COMMAND_NAME, (...args: Uri[]) => {
        if (args.length === 0) {
          return;
        }
        if (args.length === 1) {
          void workspace.openTextDocument(args[0]).then((doc) => window.showTextDocument(doc));
        }

        const fc = this.workspaceController.folderController(args[0]);
        const root = fc?.folder.uri ?? Uri.file(os.homedir());

        void window
          .showQuickPick(args.map((uri) => path.relative(root.fsPath, uri.fsPath)))
          .then(async (pick) => {
            if (pick) {
              workspace
                .openTextDocument(Uri.joinPath(root, pick))
                .then((doc) => window.showTextDocument(doc));
            }
          });
        window.showInformationMessage(
          `Codelens triggered with args: ${conjoin(args.map(Utils.basename))}`,
        );
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
        title:
          command?.title ?
            `${command?.icon ?? '$(cmtd-logo)'}${nbsp}${nbsp} ${command.title}`
          : empty,
        tooltip: command?.tooltip ?? 'Tooltip provided by css code lens extension',
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
