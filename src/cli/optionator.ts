import { cull, deepEquals } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';

import {
  type Action,
  type CMTDOptions,
  defaultOptions,
  fileOperation,
  locateCMTDConfigurationFile,
  locateViteConfigurationFile,
  type Logger,
  type LoggerController,
  loggerForLevel,
  type Options,
  type PartialOptions,
  readCMTDConfig,
  readViteConfig,
  stdioLogger,
  type ViteCss,
} from '../common/index.ts';

type OptionatorArguments = {
  readonly root: string;
  readonly watch?: boolean;
  readonly logger?: Logger;
};

export class Optionator implements LoggerController, AsyncDisposable {
  public static async create(
    top: CMTDOptions,
    { root, watch = false, logger = stdioLogger }: OptionatorArguments,
  ): Promise<Optionator> {
    const optionator = new Optionator(top, logger);

    const viteConfigPath = await locateViteConfigurationFile(root);
    if (viteConfigPath) {
      optionator.#vite = await readViteConfig(viteConfigPath);
    }

    const cmtdConfigPath = await locateCMTDConfigurationFile(root);
    if (cmtdConfigPath) {
      optionator.#cmtd = await readCMTDConfig(cmtdConfigPath);
    }

    if (watch) {
      const watched = cull([viteConfigPath, cmtdConfigPath]) as string[];
      const watcher = chokidar.watch(watched, {
        ignoreInitial: true,
        atomic: true,
      });

      const respond =
        (reason: Action) =>
        (file: string): void => {
          optionator.logger?.debug(fileOperation(file, reason));

          (async () => {
            if (file === viteConfigPath) {
              optionator.#vite = await readViteConfig(viteConfigPath);
              void optionator.optionsChanged();
              return;
            }

            if (file === cmtdConfigPath) {
              optionator.#cmtd = await readCMTDConfig(cmtdConfigPath);
              void optionator.optionsChanged();
            }
          })();
        };

      watcher
        .on('add', respond('add'))
        .on('change', respond('change'))
        .on('unlink', respond('unlink'));

      optionator.#watcher = watcher;
    }

    optionator.#options = optionator.compileOptions();

    await optionator.optionsChanged();
    return optionator;
  }

  readonly #top: PartialOptions = {};
  readonly #eventTarget: EventTarget = new EventTarget();
  readonly #listeners: Set<() => void> = new Set();
  readonly #baseLogger: Logger;
  #watcher: FSWatcher | undefined;
  #vite: ViteCss | undefined;
  #cmtd: CMTDOptions | undefined;
  #options = defaultOptions;

  private constructor(top: CMTDOptions, baseLogger: Logger) {
    this.#top = top;
    this.#baseLogger = baseLogger;
    this.#options = this.compileOptions();
  }

  private compileOptions(): Options {
    return {
      logLevel: this.#top.logLevel ?? defaultOptions.logLevel,
      unusedClassesDiagnostics:
        this.#top?.unusedClassesDiagnostics ?? defaultOptions.unusedClassesDiagnostics,
      unusedImportedClassesDiagnostics:
        this.#top?.unusedImportedClassesDiagnostics ??
        defaultOptions.unusedImportedClassesDiagnostics,
      css: {
        preprocessor: {
          less:
            this.#top.css?.preprocessor?.less ??
            this.#cmtd?.css?.preprocessor?.less ??
            this.#vite?.preprocessorOptions?.less ??
            defaultOptions.css?.preprocessor.less,
          sass:
            this.#top.css?.preprocessor?.sass ??
            this.#cmtd?.css?.preprocessor?.sass ??
            this.#vite?.preprocessorOptions?.sass ??
            defaultOptions.css?.preprocessor.sass,
          scss:
            this.#top.css?.preprocessor?.scss ??
            this.#cmtd?.css?.preprocessor?.scss ??
            this.#vite?.preprocessorOptions?.scss ??
            defaultOptions.css?.preprocessor.scss,
        },
        modules: {
          scopeBehaviour:
            this.#top?.css?.modules?.scopeBehaviour ??
            this.#cmtd?.css?.modules?.scopeBehaviour ??
            this.#vite?.modules?.scopeBehaviour ??
            defaultOptions.css.modules.scopeBehaviour,
          globalModulePaths:
            this.#top.css?.modules?.globalModulePaths ??
            this.#cmtd?.css?.modules?.globalModulePaths ??
            this.#vite?.modules?.globalModulePaths ??
            defaultOptions.css.modules.globalModulePaths,
          exportGlobals:
            this.#top?.css?.modules?.exportGlobals ??
            this.#cmtd?.css?.modules?.exportGlobals ??
            this.#vite?.modules?.exportGlobals ??
            defaultOptions.css.modules.exportGlobals,
          generateScopedName:
            this.#top?.css?.modules?.generateScopedName ??
            this.#cmtd?.css?.modules?.generateScopedName ??
            this.#vite?.modules?.generateScopedName ??
            defaultOptions.css.modules.generateScopedName,
          hashPrefix:
            this.#top?.css?.modules?.hashPrefix ??
            this.#cmtd?.css?.modules?.hashPrefix ??
            this.#vite?.modules?.hashPrefix ??
            defaultOptions.css.modules.hashPrefix,
          localsConvention:
            this.#top?.css?.modules?.localsConvention ??
            this.#cmtd?.css?.modules?.localsConvention ??
            this.#vite?.modules?.localsConvention ??
            defaultOptions.css.modules.localsConvention,
        },
        dtsHeader:
          this.#top?.css?.dtsHeader ?? this.#cmtd?.css?.dtsHeader ?? defaultOptions.css.dtsHeader,
        dtsFooter:
          this.#top?.css?.dtsFooter ?? this.#cmtd?.css?.dtsFooter ?? defaultOptions.css.dtsFooter,
        generateDts:
          this.#top?.css?.generateDts ??
          this.#cmtd?.css?.generateDts ??
          defaultOptions.css.generateDts,
        classesConvention:
          this.#top?.css?.classesConvention ??
          this.#cmtd?.css?.classesConvention ??
          defaultOptions.css.classesConvention,
      },
    };
  }

  private async optionsChanged(): Promise<void> {
    const options = this.compileOptions();

    if (!deepEquals(options, this.#options)) {
      this.#options = options;
      this.#eventTarget.dispatchEvent(new Event('change'));
    }
  }

  public get logger(): Logger {
    return loggerForLevel(this.#baseLogger, this.#options.logLevel);
  }

  public get options(): Options {
    return this.#options;
  }

  public onChange(listener: () => void): void {
    this.#listeners.add(listener);
    this.#eventTarget.addEventListener('change', listener);
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const listener of this.#listeners) {
      this.#eventTarget.removeEventListener('change', listener);
    }

    if (this.#watcher) {
      await this.#watcher.close();
      this.#watcher = undefined;
    }
  }
}
