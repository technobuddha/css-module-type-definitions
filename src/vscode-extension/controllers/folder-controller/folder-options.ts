import { deepEquals, noop } from '@technobuddha/library';
import { type Disposable, workspace, type WorkspaceConfiguration } from 'vscode';

import {
  type CMTDOptions,
  defaultOptions,
  fileOperation,
  locateCMTDConfigurationFile,
  locateViteConfigurationFile,
  type Logger,
  type LogLevel,
  operation,
  type Options,
  RANKS,
  readCMTDConfig,
  readViteConfig,
  type ViteCss,
} from '../../../common/index.ts';

import { FolderIgnorer, type FolderIgnorerArguments } from './folder-ignorer.ts';

export type FolderOptionsArguments = FolderIgnorerArguments;

export abstract class FolderOptions extends FolderIgnorer implements Disposable {
  #options = defaultOptions;
  #cmtdConfigFile: string | undefined;
  #cmtdConfig: CMTDOptions | undefined;
  #viteConfigFile: string | undefined;
  #viteConfig: ViteCss | undefined;
  #vscodeSettings: WorkspaceConfiguration | undefined;

  public constructor({ workspaceController, folder }: FolderOptionsArguments) {
    super({ workspaceController, folder });
  }

  private async readCMTDConfig(): Promise<void> {
    this.#cmtdConfig =
      this.#cmtdConfigFile ? await readCMTDConfig(this.#cmtdConfigFile) : undefined;
  }

  private async readViteConfig(): Promise<void> {
    this.#viteConfig =
      this.#viteConfigFile ? await readViteConfig(this.#viteConfigFile) : undefined;
  }

  private readVscodeSettings(): void {
    this.#vscodeSettings = workspace.getConfiguration('cmtd', this.folder.uri);
  }

  private readOptions(): Options {
    return {
      logLevel: this.#vscodeSettings?.get<LogLevel>('logLevel') ?? defaultOptions.logLevel,
      unusedClassesDiagnostics: defaultOptions.unusedClassesDiagnostics,
      unusedImportedClassesDiagnostics: defaultOptions.unusedImportedClassesDiagnostics,
      css: {
        preprocessor: {
          less: {
            ...this.#cmtdConfig?.css?.preprocessor?.less,
            ...this.#viteConfig?.preprocessorOptions?.less,
            ...defaultOptions.css?.preprocessor.less,
          },
          sass: {
            ...this.#cmtdConfig?.css?.preprocessor?.sass,
            ...this.#viteConfig?.preprocessorOptions?.sass,
            ...defaultOptions.css?.preprocessor.sass,
          },
          scss: {
            ...this.#cmtdConfig?.css?.preprocessor?.scss,
            ...this.#viteConfig?.preprocessorOptions?.scss,
            ...defaultOptions.css?.preprocessor.scss,
          },
          // styl: {
          //   ...this.#cmtdConfig?.css?.preprocessor?.styl,
          //   ...this.#viteConfig?.preprocessorOptions?.styl,
          //   ...defaultOptions.css?.preprocessor.styl,
          // },
          // stylus: {
          //   ...this.#cmtdConfig?.css?.preprocessor?.stylus,
          //   ...this.#viteConfig?.preprocessorOptions?.stylus,
          //   ...defaultOptions.css?.preprocessor.stylus,
          // },
        },
        modules: {
          scopeBehaviour:
            this.#cmtdConfig?.css?.modules?.scopeBehaviour ??
            this.#viteConfig?.modules?.scopeBehaviour ??
            defaultOptions.css.modules.scopeBehaviour,
          globalModulePaths:
            this.#cmtdConfig?.css?.modules?.globalModulePaths ??
            this.#viteConfig?.modules?.globalModulePaths ??
            defaultOptions.css.modules.globalModulePaths,
          exportGlobals:
            this.#cmtdConfig?.css?.modules?.exportGlobals ??
            this.#viteConfig?.modules?.exportGlobals ??
            defaultOptions.css.modules.exportGlobals,
          generateScopedName:
            this.#cmtdConfig?.css?.modules?.generateScopedName ??
            this.#viteConfig?.modules?.generateScopedName ??
            defaultOptions.css.modules.generateScopedName,
          hashPrefix:
            this.#cmtdConfig?.css?.modules?.hashPrefix ??
            this.#viteConfig?.modules?.hashPrefix ??
            defaultOptions.css.modules.hashPrefix,
          localsConvention:
            this.#cmtdConfig?.css?.modules?.localsConvention ??
            this.#viteConfig?.modules?.localsConvention ??
            defaultOptions.css.modules.localsConvention,
        },
        dtsHeader: this.#cmtdConfig?.css?.dtsHeader ?? defaultOptions.css.dtsHeader,
        dtsFooter: this.#cmtdConfig?.css?.dtsFooter ?? defaultOptions.css.dtsFooter,
        generateDts: this.#cmtdConfig?.css?.generateDts ?? defaultOptions.css.generateDts,
        classesConvention:
          this.#cmtdConfig?.css?.classesConvention ?? defaultOptions.css.classesConvention,
      },
    };
  }

  private async changeOptions(): Promise<void> {
    const oldOptions = this.#options;
    const newOptions = this.readOptions();
    if (deepEquals(oldOptions, newOptions)) {
      return;
    }

    this.#options = newOptions;
    await this.fire('options', { oldOptions, newOptions });
  }

  public override async init(): Promise<void> {
    await super.init();

    this.#viteConfigFile = await locateViteConfigurationFile(this.folder.uri.fsPath);
    this.#cmtdConfigFile = await locateCMTDConfigurationFile(this.folder.uri.fsPath);

    await this.readCMTDConfig();
    await this.readViteConfig();
    this.readVscodeSettings();

    this.#options = this.readOptions();

    this.disposables.push(
      workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('cmtd', this.folder)) {
          this.logger.trace(operation(`${this.folder.name}::configuration`, 'changed'));
          this.readVscodeSettings();
          await this.changeOptions();
        }
      }),
    );

    this.on('watcher', async ({ action, uri }) => {
      if (uri.fsPath === this.#viteConfigFile) {
        this.logger.debug(fileOperation(uri, action));
        await this.readViteConfig();
        await this.changeOptions();
        return;
      }

      if (uri.fsPath === this.#cmtdConfigFile) {
        this.logger.debug(fileOperation(uri, action));
        await this.readCMTDConfig();
        await this.changeOptions();
      }
    });
  }

  public get options(): Options {
    return this.#options;
  }

  public get logger(): Logger {
    const { logLevel } = this.options;
    const { logger } = this.workspaceController;

    const rank = RANKS[logLevel] ?? 2;

    return {
      trace: rank <= 0 ? logger.trace : noop,
      debug: rank <= 1 ? logger.debug : noop,
      info: rank <= 2 ? logger.info : noop,
      warn: rank <= 3 ? logger.warn : noop,
      error: rank <= 4 ? logger.error : noop,
    };
  }
}
