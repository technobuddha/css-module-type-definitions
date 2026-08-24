import {
  type CancellationToken,
  CodeLens,
  type CodeLensProvider,
  Range,
  type TextDocument,
  type Uri,
} from 'vscode';

import { type Logger } from '../../common/index.ts';

import { type WorkspaceController } from '../controllers/index.ts';

class CL extends CodeLens {
  public uri: Uri;
  public constructor(range: Range, uri: Uri) {
    super(range);
    this.uri = uri;
  }
}

/**
 * CodelensProvider
 */
export class CssCodeLensProvider implements CodeLensProvider<CL> {
  private readonly workspaceController: WorkspaceController;

  public constructor(workspaceController: WorkspaceController) {
    this.workspaceController = workspaceController;
  }

  public get logger(): Logger {
    return this.workspaceController.logger;
  }

  public provideCodeLenses(document: TextDocument, _token: CancellationToken): CL[] {
    this.logger.debug('>>>>>>', document.uri.fsPath);
    // const codeLenses: CodeLens[] = [];
    // // eslint-disable-next-line require-unicode-regexp
    // const regex = /content/g;
    // const text = document.getText();
    // const matches = text.matchAll(regex);
    // for (const match of matches) {
    //   const { line, character } = document.positionAt(match.index);
    //   const range = new Range(line, character, line, character);
    //   if (range) {
    //     codeLenses.push(new CodeLens(range));
    //   }
    // }
    return [new CL(new Range(0, 0, 0, 0), document.uri)];
  }

  public resolveCodeLens(codeLens: CL, _token: CancellationToken): CL | null {
    const fc = this.workspaceController.folderController(codeLens.uri);
    if (fc) {
      const command = fc.command(codeLens.uri);
      codeLens.command = command ?? {
        title: '',
        command: 'none',
      };
    }

    return codeLens;
  }
}
