import { debounce } from '@technobuddha/library';
import {
  commands,
  type Disposable,
  StatusBarAlignment,
  type StatusBarItem,
  type Tab,
  type TabChangeEvent,
  TabInputText,
  type Uri,
  window,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import { type LoggerController, operation } from '../../common/index.ts';

import { createLogger, UriMap } from '../helpers/index.ts';

import { FolderController } from './folder-controller/index.ts';

type TabInput = Omit<Tab, 'input'> & { input: TabInputText };
type TabState = {
  count: number;
  workspaceFolder: WorkspaceFolder | undefined;
};

export class WorkspaceController implements Disposable, LoggerController {
  public static async create(): Promise<WorkspaceController> {
    return new WorkspaceController();
  }

  private readonly statusBar: StatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    99,
  );

  protected readonly disposables: Disposable[] = [];
  protected readonly folders: Map<WorkspaceFolder, FolderController> = new Map();

  public readonly logger = createLogger();
  public readonly openTabs: UriMap<TabState> = new UriMap();

  private constructor() {
    this.statusBar.text = '$(loading~spin)';
    this.statusBar.show();

    this.disposables.push(
      this.statusBar,
      commands.registerCommand('cmtd.showOutput', () => {
        this.logger.outputChannel.show(true);
      }),
      workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        for (const folder of removed) {
          const fc = this.folders.get(folder);
          if (fc) {
            for (const state of this.openTabs.values()) {
              if (state.workspaceFolder?.uri.fsPath === folder.uri.fsPath) {
                state.workspaceFolder = undefined;
              }
            }
            await fc.close();
            this.folders.delete(folder);
            this.logger.trace(operation(fc.folder.name, 'stop'));
          }
        }

        for (const folder of added) {
          const fc = new FolderController({ workspaceController: this, folder });
          this.folders.set(folder, fc);
          await fc.init();
          for (const [uri, state] of this.openTabs) {
            if (state.workspaceFolder == null) {
              const workspaceFolder = workspace.getWorkspaceFolder(uri);
              if (workspaceFolder?.uri.fsPath === folder.uri.fsPath) {
                state.workspaceFolder = workspaceFolder;
                await this.onOpenTab(uri);
              }
            }
          }
        }
      }),

      window.tabGroups.onDidChangeTabs(async (event) => this.onChangeTabs(event)),

      workspace.onDidChangeTextDocument(
        debounce(async (change) => {
          const state = this.openTabs.get(change.document.uri);
          if (state?.workspaceFolder) {
            const fc = this.folders.get(state.workspaceFolder);
            if (fc) {
              await fc.fire('editTab', change.document.uri);
            }
          }
        }, 1000),
      ),
    );
  }

  private async onChangeTabs(event: TabChangeEvent): Promise<void> {
    for (const tab of event.opened) {
      if (isTabInput(tab)) {
        await this.onOpenTab(tab.input.uri);
      }
    }

    for (const tab of event.closed) {
      if (isTabInput(tab)) {
        await this.onCloseTab(tab.input.uri);
      }
    }
  }

  private async onOpenTab(uri: Uri): Promise<void> {
    let state = this.openTabs.get(uri);
    if (state) {
      if (state.count > 0) {
        state.count++;
        return;
      }

      state.count = 1;
    } else {
      state = {
        count: 1,
        workspaceFolder: workspace.getWorkspaceFolder(uri),
      };
      this.openTabs.set(uri, state);
    }

    if (state.workspaceFolder) {
      const fc = this.folders.get(state.workspaceFolder);
      if (fc) {
        if (!fc.isIgnored(uri)) {
          await fc.fire('openTab', uri);
        }
      }
    }
  }

  private async onCloseTab(uri: Uri): Promise<void> {
    const state = this.openTabs.get(uri);
    if (state) {
      if (state.count > 1) {
        state.count--;
        return;
      }

      if (state?.workspaceFolder) {
        const fc = this.folders.get(state.workspaceFolder);
        if (fc) {
          await fc.fire('closeTab', uri);
        }
      }

      this.openTabs.delete(uri);
    }
  }

  public async init(): Promise<void> {
    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        if (!this.folders.has(folder)) {
          this.folders.set(folder, new FolderController({ workspaceController: this, folder }));
        }
      }
    }

    for (const fc of this.folders.values()) {
      await fc.init();
    }

    for (const group of window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (isTabInput(tab)) {
          await this.onOpenTab(tab.input.uri);
        }
      }
    }

    this.statusBar.command = 'cmtd.showOutput';
    this.statusBar.text = '$(cmtd-logo)';
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

function isTabInput(tab: Tab): tab is TabInput {
  return tab.input instanceof TabInputText;
}
