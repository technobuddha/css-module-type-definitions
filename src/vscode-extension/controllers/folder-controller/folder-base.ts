import { CustomEventBase } from '@technobuddha/library';
import {
  type DiagnosticCollection,
  type Disposable,
  languages,
  RelativePattern,
  type Uri,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import {
  type Action,
  // fileOperation,
  type Logger,
  type LoggerController,
  type Options,
} from '../../../common/index.ts';

import { type CodeInformation } from '../../code-information/code-information.ts';
import { type CssInformation } from '../../css-information/css-information.ts';
import { UriSet } from '../../helpers/index.ts';

import { type WorkspaceController } from '../workspace-controller.ts';

export type FolderBaseArguments = {
  workspaceController: WorkspaceController;
  folder: WorkspaceFolder;
};

type CustomEvents = {
  watcher: {
    action: Action;
    uri: Uri;
  };
  options: {
    oldOptions: Options;
    newOptions: Options;
  };
  ignored: undefined;
  openTab: Uri;
  closeTab: Uri;
  editTab: Uri;
  cssInformationChanged: {
    uri: Uri;
    oldCssInformation: CssInformation | undefined;
    newCssInformation: CssInformation | undefined;
  };
  codeInformationChanged: {
    uri: Uri;
    oldCodeInformation: CodeInformation | undefined;
    newCodeInformation: CodeInformation | undefined;
  };
};

export abstract class FolderBase
  extends CustomEventBase<CustomEvents>
  implements LoggerController, Disposable
{
  protected readonly workspaceController: WorkspaceController;

  protected readonly openTabs: UriSet = new UriSet();
  protected readonly passTabs: UriSet = new UriSet();
  protected readonly diagnostics: DiagnosticCollection;
  protected readonly disposables: Disposable[] = [];

  public readonly folder: WorkspaceFolder;

  public constructor({ workspaceController, folder }: FolderBaseArguments) {
    super();
    this.workspaceController = workspaceController;
    this.folder = folder;

    this.diagnostics = languages.createDiagnosticCollection(folder.name);
  }

  public async init(): Promise<void> {
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(this.folder, '**/*'));

    const respond = (action: Action) => async (uri: Uri) => {
      if (this.isIgnored(uri)) {
        return;
      }

      if (this.openTabs.has(uri)) {
        if (action === 'change' || action === 'add') {
          this.workspaceController.onSaveTab(uri);
        }
      }

      await this.fire('watcher', { action, uri });
    };

    this.disposables.push(
      watcher,
      watcher.onDidCreate(respond('add')),
      watcher.onDidChange(respond('change')),
      watcher.onDidDelete(respond('unlink')),
    );

    this.on('openTab', async (uri) => {
      this.openTabs.add(uri);
    }).on('closeTab', async (uri) => {
      this.openTabs.delete(uri);
    });
  }

  public abstract close(): Promise<void>;
  public abstract get logger(): Logger;

  public abstract isIgnored(uri: Uri): boolean;

  public async dispose(): Promise<void> {
    this.diagnostics.clear();
    this.diagnostics.dispose();

    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
