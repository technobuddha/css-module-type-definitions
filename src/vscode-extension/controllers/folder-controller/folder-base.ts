import { CustomEventTarget } from '@technobuddha/library';
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
  type Logger,
  type LoggerController,
  type Options,
} from '../../../common/index.ts';

import { UriSet } from '../../helpers/index.ts';

import { type WorkspaceController } from '../workspace-controller.ts';

export type FolderBaseArguments = {
  folder: WorkspaceFolder;
  workspaceController: WorkspaceController;
};

type WatcherEvent = {
  action: Action;
  uri: Uri;
};

type OptionsEvent = {
  options: Options;
};

export abstract class FolderBase implements LoggerController, Disposable {
  protected readonly folder: WorkspaceFolder;
  protected readonly workspaceController: WorkspaceController;
  protected readonly eventTarget = new CustomEventTarget<{
    watcher: WatcherEvent;
    options: OptionsEvent;
    ignored: undefined;
  }>();
  protected readonly openTabs: UriSet = new UriSet();

  protected readonly disposables: Disposable[] = [];
  protected readonly diagnostics: DiagnosticCollection;

  public constructor({ workspaceController, folder }: FolderBaseArguments) {
    this.workspaceController = workspaceController;
    this.folder = folder;

    this.diagnostics = languages.createDiagnosticCollection(folder.name);
    this.disposables.push(this.diagnostics);
  }

  public get logger(): Logger {
    return this.workspaceController.logger;
  }

  public async init(): Promise<void> {
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(this.folder, '**/*'));

    const respond = (action: Action) => async (uri: Uri) => {
      if (!this.isIgnored(uri)) {
        this.eventTarget.dispatchEvent('watcher', { action, uri });
      }
    };

    this.disposables.push(
      watcher,
      watcher.onDidCreate(respond('add')),
      watcher.onDidChange(respond('change')),
      watcher.onDidDelete(respond('unlink')),
    );
  }

  public abstract isIgnored(uri: Uri): boolean;

  public async onOpenTab(uri: Uri): Promise<void> {
    this.openTabs.add(uri);
    return this.updateDiagnosticsForTab(uri);
  }

  public async onCloseTab(uri: Uri): Promise<void> {
    this.diagnostics.delete(uri);
    this.openTabs.delete(uri);
  }

  public abstract updateDiagnosticsForTab(uri: Uri): Promise<void>;

  public async dispose(): Promise<void> {
    this.diagnostics.clear();

    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
