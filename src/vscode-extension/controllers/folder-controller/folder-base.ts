import { CustomEventTarget } from '@technobuddha/library';
import { type DiagnosticCollection, type Disposable, type Uri, type WorkspaceFolder } from 'vscode';

import { type Logger, type LoggerController, type Options } from '../../../common/index.ts';

import { type WorkspaceController } from '../workspace-controller.ts';

export type FolderBaseArguments = {
  folder: WorkspaceFolder;
  workspaceController: WorkspaceController;
};

type WatcherEvent = {
  action: 'add' | 'change' | 'unlink';
  uri: Uri;
};

type OptionsEvent = {
  options: Options;
};

export abstract class FolderBase implements LoggerController, Disposable {
  public static async init(_controller: FolderBase): Promise<void> {
    //
  }

  protected readonly folder: WorkspaceFolder;
  protected readonly workspaceController: WorkspaceController;
  protected readonly eventTarget = new CustomEventTarget<{
    watcher: WatcherEvent;
    options: OptionsEvent;
    ignored: undefined;
  }>();
  protected readonly disposables: Disposable[] = [];

  public constructor({ workspaceController, folder }: FolderBaseArguments) {
    this.workspaceController = workspaceController;
    this.folder = folder;
  }

  public get logger(): Logger {
    return this.workspaceController.logger;
  }

  public get diagnostics(): DiagnosticCollection {
    return this.workspaceController.diagnostics;
  }

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
