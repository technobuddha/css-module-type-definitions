import { CustomEventBase } from '@technobuddha/library';
import {
  type DiagnosticCollection,
  type Disposable,
  languages,
  type Uri,
  type WorkspaceFolder,
} from 'vscode';

import { type Logger, type LoggerController, type Options } from '../../../common/index.ts';

import { UriSet } from '../../helpers/index.ts';

import { type WorkspaceController } from '../workspace-controller.ts';

export type FolderBaseArguments = {
  readonly workspaceController: WorkspaceController;
  readonly folder: WorkspaceFolder;
};

type CustomEvents = {
  readonly options: {
    readonly oldOptions: Options;
    readonly newOptions: Options;
  };
  readonly ignored: undefined;
  readonly openTab: Uri;
  readonly closeTab: Uri;
  readonly editTab: Uri;
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

  protected abstract init(): Promise<void>[];

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
