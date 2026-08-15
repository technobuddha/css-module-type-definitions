import { debounce } from '@technobuddha/library';
import {
  type Disposable,
  type Tab,
  type TabChangeEvent,
  TabInputText,
  type Uri,
  window,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import { type Logger, type LoggerController, operation } from '../../common/index.ts';

import { createLogger, UriMap } from '../helpers/index.ts';

import { FolderController } from './folder-controller/index.ts';

type TabInput = Omit<Tab, 'input'> & { input: TabInputText };
type TabState = {
  count: number;
  workspaceFolder: WorkspaceFolder | undefined;
};

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
      workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
        for (const folder of removed) {
          const fc = wc.folders.get(folder);
          if (fc) {
            for (const state of wc.openTabs.values()) {
              if (state.workspaceFolder?.uri.fsPath === folder.uri.fsPath) {
                state.workspaceFolder = undefined;
              }
            }
            await fc.close();
            wc.folders.delete(folder);
            wc.logger.trace(operation(fc.folder.name, 'stop'));
          }
        }

        for (const folder of added) {
          const fc = new FolderController({ workspaceController: wc, folder });
          wc.folders.set(folder, fc);
          await fc.init();
          for (const [uri, state] of wc.openTabs) {
            if (state.workspaceFolder == null) {
              const workspaceFolder = workspace.getWorkspaceFolder(uri);
              if (workspaceFolder?.uri.fsPath === folder.uri.fsPath) {
                state.workspaceFolder = workspaceFolder;
                await wc.onOpenTab(uri);
              }
            }
          }
        }
      }),

      // window.tabGroups.onDidChangeTabGroups(async (event) => {
      //   await wc.examineTabs();
      // }),
      window.tabGroups.onDidChangeTabs(async (event) => wc.onChangeTabs(event)),

      workspace.onDidChangeTextDocument(
        debounce(async (change) => {
          const state = wc.openTabs.get(change.document.uri);
          if (state?.workspaceFolder) {
            const fc = wc.folders.get(state.workspaceFolder);
            if (fc) {
              await fc.fire('editTab', change.document.uri);
            }
          }
        }, 1000),
      ),
    );

    for (const group of window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (isTabInput(tab)) {
          await wc.onOpenTab(tab.input.uri);
        }
      }
    }

    return wc;
  }

  protected readonly disposables: Disposable[] = [];
  protected readonly folders: Map<WorkspaceFolder, FolderController> = new Map();
  public readonly logger: Logger = createLogger();
  public readonly openTabs: UriMap<TabState> = new UriMap();

  // private async examineTabs(): Promise<void> {
  //   const current = new Set(this.openTabs.keys());

  //   for (const group of window.tabGroups.all) {
  //     for (const tab of group.tabs) {
  //       if (isTabInput(tab)) {
  //         if (this.openTabs.has(tab)) {
  //           current.delete(tab);
  //         } else {
  //           this.openTabs.set(tab, workspace.getWorkspaceFolder(tab.input.uri));
  //           await this.onOpenTab(tab);
  //         }
  //       }
  //     }
  //   }

  //   for (const tab of current) {
  //     await this.onCloseTab(tab);
  //   }
  // }

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

    // for (const tab of event.changed) {
    //   if (isTabInput(tab)) {
    //     const state = this.openTabs.get(tab.input.uri);
    //     if (state) {
    //       if (state.isDirty !== tab.isDirty) {
    //         state.wasDirty = state.isDirty;
    //         state.isDirty ||= tab.isDirty;
    //       }
    //     }
    //   }
    // }
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

  public onSaveTab(_uri: Uri): void {
    // nothig to do here, but this is a hook for future use
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
