import { debounce } from '@technobuddha/library';
import {
  type Disposable,
  TabInputText,
  type TextDocument,
  type TextEditor,
  type Uri,
  window,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import {
  fileOperation,
  type Logger,
  type LoggerController,
  operation,
} from '../../common/index.ts';

import { createLogger } from '../create-logger.ts';
import { UriSet } from '../helpers/index.ts';

import { FolderController } from './folder-controller/index.ts';

export class WorkspaceController implements Disposable, LoggerController {
  public static async create(): Promise<WorkspaceController> {
    const wc = new WorkspaceController();

    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        if (!wc.folders.has(folder)) {
          wc.folders.set(folder, new FolderController({ workspaceController: wc, folder }));
        }
      }
    }

    for (const fc of wc.folders.values()) {
      await fc.init();
    }

    wc.disposables.push(
      // workspace.onDidChangeConfiguration(async (event) => {
      //   if (event.affectsConfiguration(SETTINGS_PREFIX)) {
      //     this.logger.info('Relevant configuration change detected, updating options...');
      //     await this.loadOptions();
      //     this.onDidChangeEmitter.fire(event);
      //   }
      // }),
      workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        wc.logger.trace(operation('Workspace folders changed', 'start'));
        for (const folder of removed) {
          const fc = wc.folders.get(folder);
          if (fc) {
            await fc.dispose();
            wc.folders.delete(folder);
          }
        }

        for (const folder of added) {
          const fc = new FolderController({ workspaceController: wc, folder });
          wc.folders.set(folder, fc);
          await fc.init();
        }
        wc.logger.trace(operation('Workspace folders changed', 'finish'));
      }),

      window.tabGroups.onDidChangeTabGroups(async () => {
        await wc.examineTabs();
      }),
      window.tabGroups.onDidChangeTabs(async () => {
        await wc.examineTabs();
      }),

      workspace.onDidChangeTextDocument(
        debounce(async (change) => wc.onTextDocumentChange(change.document), 1000),
      ),
    );

    wc.logger.trace(operation('Examining open tabs for workspace folders', 'start'));
    for (const group of window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof TabInputText) {
          wc.openDocuments.add(tab.input.uri);
        }
      }
    }

    for (const uri of wc.openDocuments) {
      await wc.onOpenTab(uri);
    }
    wc.logger.trace(operation('Examining open tabs for workspace folders', 'finish'));

    return wc;
  }

  protected readonly disposables: Disposable[] = [];
  protected readonly textEditors: Set<TextEditor> = new Set();
  protected readonly folders: Map<WorkspaceFolder, FolderController> = new Map();
  public readonly logger: Logger = createLogger();
  public readonly openDocuments: UriSet = new UriSet();

  private async examineTabs(): Promise<void> {
    const current = new UriSet(this.openDocuments);

    for (const group of window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof TabInputText) {
          if (this.openDocuments.has(tab.input.uri)) {
            current.delete(tab.input.uri);
          } else {
            this.openDocuments.add(tab.input.uri);
            await this.onOpenTab(tab.input.uri);
          }
        }
      }
    }

    for (const uri of current) {
      this.openDocuments.delete(uri);
      await this.onCloseTab(uri);
    }
  }

  private async onOpenTab(uri: Uri): Promise<void> {
    const folder = workspace.getWorkspaceFolder(uri);
    if (folder) {
      const fc = this.folders.get(folder);
      if (fc) {
        if (!fc.isIgnored(uri)) {
          this.logger.debug(fileOperation(uri.fsPath, 'open'));
          await fc.onOpenTab(uri);
        }
      }
    }
  }

  private async onCloseTab(uri: Uri): Promise<void> {
    const folder = workspace.getWorkspaceFolder(uri);
    if (folder) {
      const fc = this.folders.get(folder);
      if (fc) {
        this.logger.debug(fileOperation(uri.fsPath, 'close'));
        await fc.onCloseTab(uri);
      }
    }
  }

  private async onTextDocumentChange(document: TextDocument): Promise<void> {
    const folder = workspace.getWorkspaceFolder(document.uri);
    if (folder) {
      const fc = this.folders.get(folder);
      if (fc) {
        this.logger.debug(fileOperation(document.uri.fsPath, 'changed'));
        await fc.updateDiagnosticsForTab(document.uri);
      }
    }
  }

  public folderController(file: Uri): FolderController | undefined {
    const folder = workspace.getWorkspaceFolder(file);
    if (folder) {
      return this.folders.get(folder);
    }

    return undefined;
  }

  public *folderControllers(): Generator<FolderController> {
    for (const fc of this.folders.values()) {
      yield fc;
    }
  }

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;

    for (const fc of this.folders.values()) {
      await fc.dispose();
    }
    this.folders.clear();
  }
}
