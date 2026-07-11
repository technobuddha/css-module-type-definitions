import path from 'node:path';

import { deepEquals } from '@technobuddha/library';
import { type Disposable, type Uri, workspace, type WorkspaceFolder } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  defaultOptions,
  fileOperation,
  locateCMTDConfigurationFile,
  locateViteConfigurationFile,
  type LoggerController,
  type NormalizedOptions,
  normalizeOptions,
  type Options,
  readCMTDConfig,
  readViteConfig,
  type ViteCss,
} from '../../../common/index.ts';

import { FolderIgnorer } from './folder-ignorer.ts';

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderOptions extends FolderIgnorer implements Disposable {
  public static override async init(controller: FolderIgnorer): Promise<void> {
    await super.init(controller);

    if (controller instanceof this) {
      controller.setCMTDConfigFile(await locateCMTDConfigurationFile(controller.folder.uri.fsPath));
      controller.setViteConfigFile(await locateViteConfigurationFile(controller.folder.uri.fsPath));

      await controller.readCMTDConfig();
      await controller.readViteConfig();
      controller.#options = controller.loadOptions();
    }
  }

  #options = normalizeOptions(defaultOptions);
  #cmtdConfigFile: string | undefined;
  #cmtdConfig: Options | undefined;
  #viteConfigFile: string | undefined;
  #viteConfig: ViteCss | undefined;

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ folder, logger });

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

  private async readCMTDConfig(): Promise<void> {
    this.#cmtdConfig =
      this.#cmtdConfigFile ? await readCMTDConfig(this.#cmtdConfigFile) : undefined;
  }

  private async readViteConfig(): Promise<void> {
    this.#viteConfig =
      this.#viteConfigFile ? await readViteConfig(this.#viteConfigFile) : undefined;
  }

  private changeOptions(): void {
    const options = this.loadOptions();
    if (!deepEquals(this.#options, options)) {
      this.#options = options;
      this.eventTarget.dispatchEvent('options', { options });
    }
  }

  private loadOptions(): NormalizedOptions {
    return normalizeOptions({
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
      cssModules: {
        scopeBehaviour:
          this.#cmtdConfig?.cssModules?.scopeBehaviour ??
          this.#viteConfig?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          this.#cmtdConfig?.cssModules?.globalModulePaths ??
          this.#viteConfig?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          this.#cmtdConfig?.cssModules?.exportGlobals ??
          this.#viteConfig?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          this.#cmtdConfig?.cssModules?.generateScopedName ??
          this.#viteConfig?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          this.#cmtdConfig?.cssModules?.hashPrefix ??
          this.#viteConfig?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          this.#cmtdConfig?.cssModules?.localsConvention ??
          this.#viteConfig?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsHeader: this.#cmtdConfig?.cssModules?.dtsHeader ?? defaultOptions.cssModules.dtsHeader,
        dtsFooter: this.#cmtdConfig?.cssModules?.dtsFooter ?? defaultOptions.cssModules.dtsFooter,
        generateDts:
          this.#cmtdConfig?.cssModules?.generateDts ?? defaultOptions.cssModules.generateDts,
        modulePattern:
          this.#cmtdConfig?.cssModules?.modulePattern ?? defaultOptions.cssModules.modulePattern,
        extensions:
          this.#cmtdConfig?.cssModules?.extensions ?? defaultOptions.cssModules.extensions,
      },
    });
  }

  public get options(): NormalizedOptions {
    return this.#options;
  }

  public globIsCss(): string {
    const { extensions } = this.options.cssModules;

    if (extensions.length === 1) {
      return `*.${extensions[0]}`;
    }

    return `*.{${extensions.join(',')}}`;
  }

  public globIsCssModule(): string {
    const { modulePattern, extensions } = this.options.cssModules;

    if (extensions.length === 1) {
      return `${modulePattern}.${extensions[0]}`;
    }

    return `${modulePattern}.{${extensions.join(',')}}`;
  }

  public globIsTypeDefinition(): string {
    const { modulePattern, extensions } = this.options.cssModules;

    return `${modulePattern}.{${extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public isRelative(filename: string | Uri): boolean {
    return reIsRelative.test(typeof filename === 'string' ? filename : filename.fsPath);
  }

  public isCss(filename: Uri): boolean {
    const folder = workspace.getWorkspaceFolder(filename);
    if (folder) {
      return path.matchesGlob(Utils.basename(filename), this.globIsCss());
    }
    return false;
  }

  public isCssModule(filename: Uri): boolean {
    const folder = workspace.getWorkspaceFolder(filename);
    if (folder) {
      return path.matchesGlob(Utils.basename(filename), this.globIsCssModule());
    }
    return false;
  }

  public isRelativeCSS(filename: Uri): boolean {
    return this.isRelative(filename) && this.isCssModule(filename);
  }

  public override async dispose(): Promise<void> {
    await super.dispose();
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
