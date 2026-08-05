import { deepEquals } from '@technobuddha/library';
import { type Disposable } from 'vscode';

import {
  defaultOptions,
  fileOperation,
  locateCMTDConfigurationFile,
  locateViteConfigurationFile,
  type Options,
  readCMTDConfig,
  readViteConfig,
  type ViteCss,
} from '../../../common/index.ts';

import { FolderIgnorer, type FolderIgnorerArguments } from './folder-ignorer.ts';

export type FolderOptionsArguments = FolderIgnorerArguments;

export abstract class FolderOptions extends FolderIgnorer implements Disposable {
  public static override async init(controller: FolderOptions): Promise<void> {
    await super.init(controller);

    controller.setCMTDConfigFile(await locateCMTDConfigurationFile(controller.folder.uri.fsPath));
    controller.setViteConfigFile(await locateViteConfigurationFile(controller.folder.uri.fsPath));

    await controller.readCMTDConfig();
    await controller.readViteConfig();
    controller.setOptions(controller.buildOptions());
  }

  #options = defaultOptions;
  #cmtdConfigFile: string | undefined;
  #cmtdConfig: Options | undefined;
  #viteConfigFile: string | undefined;
  #viteConfig: ViteCss | undefined;

  public constructor({ workspaceController, folder }: FolderOptionsArguments) {
    super({ workspaceController, folder });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (uri.fsPath === this.#viteConfigFile) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        await this.readViteConfig();
        this.changeOptions();
        return;
      }

      if (uri.fsPath === this.#cmtdConfigFile) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        await this.readCMTDConfig();
        this.changeOptions();
      }
    });
  }

  private setCMTDConfigFile(file: string | undefined): void {
    this.#cmtdConfigFile = file;
  }

  private setViteConfigFile(file: string | undefined): void {
    this.#viteConfigFile = file;
  }

  private setOptions(options: Options): void {
    this.#options = options;
  }

  private async readCMTDConfig(): Promise<void> {
    this.#cmtdConfig =
      this.#cmtdConfigFile ? await readCMTDConfig(this.#cmtdConfigFile) : undefined;
  }

  private async readViteConfig(): Promise<void> {
    this.#viteConfig =
      this.#viteConfigFile ? await readViteConfig(this.#viteConfigFile) : undefined;
  }

  private changeOptions(): void {
    const options = this.buildOptions();
    if (!deepEquals(this.#options, options)) {
      this.#options = options;
      this.eventTarget.dispatchEvent('options', { options });
    }
  }

  private buildOptions(): Options {
    return {
      logLevel: defaultOptions.logLevel,
      preprocessor: {
        less: {
          ...this.#cmtdConfig?.preprocessor?.less,
          ...this.#viteConfig?.preprocessorOptions?.less,
          ...defaultOptions.preprocessor.less,
        },
        sass: {
          ...this.#cmtdConfig?.preprocessor?.sass,
          ...this.#viteConfig?.preprocessorOptions?.sass,
          ...defaultOptions.preprocessor.sass,
        },
        scss: {
          ...this.#cmtdConfig?.preprocessor?.scss,
          ...this.#viteConfig?.preprocessorOptions?.scss,
          ...defaultOptions.preprocessor.scss,
        },
        styl: {
          ...this.#cmtdConfig?.preprocessor?.styl,
          ...this.#viteConfig?.preprocessorOptions?.styl,
          ...defaultOptions.preprocessor.styl,
        },
        stylus: {
          ...this.#cmtdConfig?.preprocessor?.stylus,
          ...this.#viteConfig?.preprocessorOptions?.stylus,
          ...defaultOptions.preprocessor.stylus,
        },
      },
      css: {
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

  public get options(): Options {
    return this.#options;
  }

  public override async dispose(): Promise<void> {
    await super.dispose();
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
