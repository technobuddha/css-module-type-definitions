import { type Disposable, RelativePattern, type Uri, workspace } from 'vscode';

import { type Action, fileOperation, isCode, isCss } from '../../../common/index.ts';

import { FolderCode, type FolderCodeArguments } from './folder-code.ts';

export type FolderEventHandlerArguments = FolderCodeArguments;

export abstract class FolderEventHandler extends FolderCode implements Disposable {
  public override async init(): Promise<void> {
    await super.init();

    const watcher = workspace.createFileSystemWatcher(new RelativePattern(this.folder, '**/*'));
    const respond = (action: Action) => async (uri: Uri) => {
      if (this.isIgnored(uri)) {
        return;
      }

      await this.handleWatcher({ action, uri });
    };

    this.disposables.push(
      watcher,
      watcher.onDidCreate(respond('add')),
      watcher.onDidChange(respond('change')),
      watcher.onDidDelete(respond('unlink')),
    );

    this.on('options', async ({ oldOptions, newOptions }) => {
      await this.handleOptions({ oldOptions, newOptions });
    });
    this.on('ignored', async () => {
      await this.handleIgnored();
    });
    this.on('openTab', async (uri) => {
      await this.handleOpenTab(uri);
    });
    this.on('editTab', async (uri) => {
      await this.handleEditTab(uri);
    });
    this.on('closeTab', async (uri) => {
      await this.handleCloseTab(uri);
    });
  }

  protected async handleOpenTab(uri: Uri): Promise<void> {
    this.openTabs.add(uri);
    if (isCss(uri) || isCode(uri)) {
      this.logger.debug(fileOperation(uri, 'opened'));
      return this.updateDiagnostics(uri);
    }
  }

  protected async handleEditTab(uri: Uri): Promise<void> {
    if (isCss(uri) || isCode(uri)) {
      this.logger.debug(fileOperation(uri, 'edited'));
      await this.updateInformation(uri).then(async () => this.updateDiagnostics(uri));
    }
  }

  protected async handleCloseTab(uri: Uri): Promise<void> {
    this.openTabs.delete(uri);
    if (isCss(uri) || isCode(uri)) {
      this.logger.debug(fileOperation(uri, 'closed'));
      this.diagnostics.delete(uri);
      await this.updateInformation(uri);
    }
  }
}
