/* eslint-disable require-atomic-updates */
import path from 'node:path';

import { cull, deepEquals, locatePackageRoot } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { type ResolvedConfig, type UserConfig } from 'vite';

import { fileOperation } from './file-operation.ts';
import { type Logger, type LoggerController, loggerForLevel, stdioLogger } from './logger.ts';
import {
  defaultOptions,
  type NormalizedOptions,
  normalizeOptions,
  type Options,
  type PartialOptions,
} from './options.ts';
import { locateCMTDConfigurationFile } from './read-cmtd-config.ts';
import {
  locateViteConfigurationFile,
  readViteConfig,
  transformViteConfig,
  type ViteCss,
} from './read-vite-config.ts';
import { reImport } from './reimport.ts';

type OptionatorOptions = {
  watch?: boolean;
  vite?: UserConfig | ResolvedConfig;
  logger?: Logger;
};

export class Optionator implements LoggerController, AsyncDisposable {
  public static async create(
    top: PartialOptions = {},
    { watch = false, vite, logger = stdioLogger }: OptionatorOptions = {},
  ): Promise<Optionator> {
    const root = (await locatePackageRoot()) ?? process.cwd();

    const optionator = new Optionator(top, logger);

    let viteConfigPath: string | undefined = undefined;
    if (vite) {
      optionator.#vite = transformViteConfig(vite);
    } else {
      viteConfigPath = await locateViteConfigurationFile(root);
      if (viteConfigPath) {
        optionator.logger?.debug(
          fileOperation(path.relative(root, viteConfigPath), 'configuration'),
        );

        optionator.#vite = await readViteConfig(viteConfigPath);
      }
    }

    const cmtdConfigPath = await locateCMTDConfigurationFile(root);
    if (cmtdConfigPath) {
      optionator.logger?.debug(fileOperation(path.relative(root, cmtdConfigPath), 'configuration'));
      optionator.#cmtd = await reImport<Options>(cmtdConfigPath);
    }

    if (watch) {
      const watched = cull([viteConfigPath, cmtdConfigPath]) as string[];
      const watcher = chokidar.watch(watched, {
        ignoreInitial: true,
        atomic: true,
      });

      const respond =
        (reason: 'add' | 'change' | 'unlink') =>
        (file: string): void => {
          optionator.logger?.debug(fileOperation(file, reason));

          (async () => {
            if (viteConfigPath && file === viteConfigPath) {
              optionator.#vite = await readViteConfig(viteConfigPath);
              void optionator.optionsChanged();
              return;
            }

            if (cmtdConfigPath && file === cmtdConfigPath) {
              optionator.#cmtd = await reImport<Options>(cmtdConfigPath);
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
  #cmtd: Options | undefined;
  #options = normalizeOptions(defaultOptions);

  private constructor(top: PartialOptions, baseLogger: Logger) {
    this.#top = top;
    this.#baseLogger = baseLogger;
    this.#options = this.compileOptions();
  }

  private compileOptions(): NormalizedOptions {
    return normalizeOptions({
      logLevel: this.#top.logLevel ?? defaultOptions.logLevel,
      preprocessor: {
        less:
          this.#top.preprocessor?.less ??
          this.#cmtd?.preprocessor?.less ??
          this.#vite?.preprocessorOptions?.less ??
          defaultOptions.preprocessor.less,
        sass:
          this.#top.preprocessor?.sass ??
          this.#cmtd?.preprocessor?.sass ??
          this.#vite?.preprocessorOptions?.sass ??
          defaultOptions.preprocessor.sass,
        scss:
          this.#top.preprocessor?.scss ??
          this.#cmtd?.preprocessor?.scss ??
          this.#vite?.preprocessorOptions?.scss ??
          defaultOptions.preprocessor.scss,
        styl:
          this.#top.preprocessor?.styl ??
          this.#cmtd?.preprocessor?.styl ??
          this.#vite?.preprocessorOptions?.styl ??
          defaultOptions.preprocessor.styl,
        stylus:
          this.#top?.preprocessor?.stylus ??
          this.#cmtd?.preprocessor?.stylus ??
          this.#vite?.preprocessorOptions?.stylus ??
          defaultOptions.preprocessor.stylus,
      },
      cssModules: {
        scopeBehaviour:
          this.#top?.cssModules?.scopeBehaviour ??
          this.#cmtd?.cssModules?.scopeBehaviour ??
          this.#vite?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          this.#top.cssModules?.globalModulePaths ??
          this.#cmtd?.cssModules?.globalModulePaths ??
          this.#vite?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          this.#top?.cssModules?.exportGlobals ??
          this.#cmtd?.cssModules?.exportGlobals ??
          this.#vite?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          this.#top?.cssModules?.generateScopedName ??
          this.#cmtd?.cssModules?.generateScopedName ??
          this.#vite?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          this.#top?.cssModules?.hashPrefix ??
          this.#cmtd?.cssModules?.hashPrefix ??
          this.#vite?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          this.#top?.cssModules?.localsConvention ??
          this.#cmtd?.cssModules?.localsConvention ??
          this.#vite?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsHeader:
          this.#top?.cssModules?.dtsHeader ??
          this.#cmtd?.cssModules?.dtsHeader ??
          defaultOptions.cssModules.dtsHeader,
        dtsFooter:
          this.#top?.cssModules?.dtsFooter ??
          this.#cmtd?.cssModules?.dtsFooter ??
          defaultOptions.cssModules.dtsFooter,
        generateDtsOnSave:
          this.#top?.cssModules?.generateDtsOnSave ??
          this.#cmtd?.cssModules?.generateDtsOnSave ??
          defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          this.#top?.cssModules?.modulePattern ??
          this.#cmtd?.cssModules?.modulePattern ??
          defaultOptions.cssModules.modulePattern,
        extensions:
          this.#top?.cssModules?.extensions ??
          this.#cmtd?.cssModules?.extensions ??
          defaultOptions.cssModules.extensions,
      },
    });
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

  public get options(): NormalizedOptions {
    return this.#options;
  }

  public get globIsCss(): string {
    const { modulePattern, extensions } = this.#options.cssModules;

    if (extensions.length === 0) {
      return modulePattern;
    }
    if (extensions.length === 1) {
      return `${modulePattern}.${extensions[0]}`;
    }

    return `${modulePattern}.{${extensions.join(',')}}`;
  }

  public get globIsTypeDefinition(): string {
    const { modulePattern, extensions } = this.#options.cssModules;

    if (extensions.length === 0) {
      return `${modulePattern}.d{.ts,.ts.map}`;
    }

    return `${modulePattern}.{${extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
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
