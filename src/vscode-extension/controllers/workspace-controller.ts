import {
  type DiagnosticCollection,
  type Disposable,
  languages,
  TabInputText,
  type TextDocument,
  type TextEditor,
  type Uri,
  window,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import { isCode, type Logger, type LoggerController } from '../../common/index.ts';

import { createLogger } from '../create-logger.ts';
import { UriSet } from '../helpers/index.ts';

import { FolderController } from './folder-controller/index.ts';

export class WorkspaceController implements Disposable, LoggerController {
  public static async create(): Promise<WorkspaceController> {
    const wc = new WorkspaceController();

    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        if (!wc.folders.has(folder)) {
          const fc = await FolderController.create({
            workspaceController: wc,
            folder,
          });
          wc.folders.set(folder, fc);
        }
      }
    }

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

    return wc;
  }

  protected readonly disposables: Disposable[] = [];
  protected readonly textEditors: Set<TextEditor> = new Set();
  protected readonly folders: Map<WorkspaceFolder, FolderController> = new Map();
  public readonly logger: Logger = createLogger();
  public readonly diagnostics: DiagnosticCollection;
  public readonly openDocuments: UriSet = new UriSet();

  public constructor() {
    this.diagnostics = languages.createDiagnosticCollection('cmtd');

    this.disposables.push(
      this.diagnostics,
      // workspace.onDidChangeConfiguration(async (event) => {
      //   if (event.affectsConfiguration(SETTINGS_PREFIX)) {
      //     this.logger.info('Relevant configuration change detected, updating options...');
      //     await this.loadOptions();
      //     this.onDidChangeEmitter.fire(event);
      //   }
      // }),
      workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        for (const folder of removed) {
          const fc = this.folders.get(folder);
          if (fc) {
            await fc.dispose();
            this.folders.delete(folder);
          }
        }

        for (const folder of added) {
          const fc = await FolderController.create({
            folder,
            workspaceController: this,
          });
          this.folders.set(folder, fc);
        }
      }),

      window.tabGroups.onDidChangeTabGroups(async () => {
        await this.examineTabs();
      }),
      window.tabGroups.onDidChangeTabs(async () => {
        await this.examineTabs();
      }),

      workspace.onDidChangeTextDocument(async (change) =>
        this.onTextDocumentChange(change.document),
      ),
    );
  }

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
        await fc.onOpenTab(uri);
      }
    }
  }

  private async onCloseTab(uri: Uri): Promise<void> {
    if (isCode(uri)) {
      const folder = workspace.getWorkspaceFolder(uri);
      if (folder) {
        const fc = this.folders.get(folder);
        if (fc) {
          await fc.onCloseTab(uri);
        }
      }
    }
  }

  private async onTextDocumentChange(document: TextDocument): Promise<void> {
    const folder = workspace.getWorkspaceFolder(document.uri);
    if (folder) {
      const fc = this.folders.get(folder);
      if (fc) {
        this.logger.trace(`Document changed: ${document.uri.fsPath}`);
        await fc.updateTab(document.uri);
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
