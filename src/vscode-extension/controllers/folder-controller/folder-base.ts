import { CustomEventTarget } from '@technobuddha/library';
import { type DiagnosticCollection, type Disposable, type Uri, type WorkspaceFolder } from 'vscode';

import {
  type Action,
  fileOperation,
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
  protected readonly openTabs: UriSet = new UriSet();

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

  public async onOpenTab(uri: Uri): Promise<void> {
    this.logger.debug(fileOperation(uri.fsPath, 'open'));
    this.openTabs.add(uri);
    return this.updateTab(uri);
  }

  public async onCloseTab(uri: Uri): Promise<void> {
    this.logger.debug(fileOperation(uri.fsPath, 'close'));
    this.diagnostics.delete(uri);
    this.openTabs.delete(uri);
  }

  public async updateTab(_uri: Uri): Promise<void> {
    //
  }

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
