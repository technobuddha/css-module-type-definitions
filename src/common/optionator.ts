/* eslint-disable require-atomic-updates */
import path from 'node:path';

import { deepEquals, locatePackageRoot } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { type ResolvedConfig, type UserConfig } from 'vite';

import { fileOperation } from './file-operation.ts';
import { type Logger, loggerOutput, stdioLogger } from './logger.ts';
import { defaultOptions, type Options, type PartialOptions } from './options.ts';
import {
  locateViteConfigurationFile,
  readViteConfig,
  transformViteConfig,
  type ViteCss,
} from './read-vite-config.ts';
import { locateVSCodeConfigrationFile, readVSCodeSettings } from './read-vscode-settings.ts';

type OptionatorOptions = {
  watch?: boolean;
  vite?: UserConfig | ResolvedConfig;
  logger?: Logger;
};

export class Optionator implements AsyncDisposable {
  readonly #top: PartialOptions = {};
  readonly #eventTarget: EventTarget = new EventTarget();
  readonly #listeners: Set<() => void> = new Set();
  readonly #baseLogger: Logger;
  #vite: ViteCss | undefined;
  #vscode: Awaited<ReturnType<typeof readVSCodeSettings>> | undefined;
  #options: Options = defaultOptions;
  readonly #watcher: Set<FSWatcher> = new Set();
  #logger: Logger;

  public static async create(
    top: PartialOptions = {},
    { watch = false, vite, logger = stdioLogger }: OptionatorOptions = {},
  ): Promise<Optionator> {
    logger.debug('Initializing Optionator...', JSON.stringify(top));

    const root = (await locatePackageRoot()) ?? process.cwd();

    const optionator = new Optionator(top, logger);

    const vscodeConfigPath = await locateVSCodeConfigrationFile(root);
    if (vscodeConfigPath) {
      optionator.#logger?.debug(
        fileOperation(path.relative(root, vscodeConfigPath), 'configuration'),
      );

      if (watch) {
        const watcher = chokidar.watch(vscodeConfigPath, {
          ignoreInitial: true,
          persistent: true,
          atomic: true,
        });

        const respond = (reason: 'add' | 'change' | 'unlink') => (file: string) => {
          optionator.#logger?.debug(fileOperation(file, reason));
          void optionator.readOptions();
        };

        watcher.on('add', respond('add'));
        watcher.on('change', respond('change'));
        watcher.on('unlink', respond('unlink'));

        optionator.#watcher.add(watcher);
      }

      optionator.#vscode = await readVSCodeSettings(vscodeConfigPath, optionator.#logger);
    }

    if (vite) {
      optionator.#vite = transformViteConfig(vite);
    } else {
      const viteConfigPath = await locateViteConfigurationFile(root);

      if (viteConfigPath) {
        optionator.#logger?.debug(
          fileOperation(path.relative(root, viteConfigPath), 'configuration'),
        );

        if (watch) {
          const watcher = chokidar.watch(viteConfigPath, {
            ignoreInitial: true,
            persistent: true,
            atomic: true,
          });

          const respond =
            (reason: 'add' | 'change' | 'unlink') =>
            (file: string): void => {
              optionator.#logger?.debug(fileOperation(file, reason));

              (async () => {
                optionator.#vite = await readViteConfig(viteConfigPath, optionator.#logger);
                void optionator.readOptions();
              })();
            };

          watcher
            .on('add', respond('add'))
            .on('change', respond('change'))
            .on('unlink', respond('unlink'));

          optionator.#watcher.add(watcher);
        }

        optionator.#vite = await readViteConfig(viteConfigPath, optionator.#logger);
      }
    }

    optionator.#options = optionator.compileOptions();
    optionator.#logger = optionator.buildLogger();

    await optionator.readOptions();
    return optionator;
  }

  private constructor(top: PartialOptions, baseLogger: Logger) {
    this.#top = top;
    this.#baseLogger = baseLogger;
    this.#options = this.compileOptions();

    this.#logger = this.buildLogger();
  }

  private compileOptions(): Options {
    return {
      logLevel: this.#top.logLevel ?? this.#vscode?.logLevel ?? defaultOptions.logLevel,
      preprocessor: {
        less:
          this.#top.preprocessor?.less ??
          this.#vite?.preprocessorOptions?.less ??
          defaultOptions.preprocessor.less,
        sass:
          this.#top.preprocessor?.sass ??
          this.#vite?.preprocessorOptions?.sass ??
          defaultOptions.preprocessor.sass,
        scss:
          this.#top.preprocessor?.scss ??
          this.#vite?.preprocessorOptions?.scss ??
          defaultOptions.preprocessor.scss,
        styl:
          this.#top.preprocessor?.styl ??
          this.#vite?.preprocessorOptions?.styl ??
          defaultOptions.preprocessor.styl,
        stylus:
          this.#top.preprocessor?.stylus ??
          this.#vite?.preprocessorOptions?.stylus ??
          defaultOptions.preprocessor.stylus,
      },
      cssModules: {
        scopeBehaviour:
          this.#top.cssModules?.scopeBehaviour ??
          this.#vscode?.scopeBehaviour ??
          this.#vite?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          this.#top.cssModules?.globalModulePaths ??
          this.#vscode?.globalModulePaths ??
          this.#vite?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          this.#top.cssModules?.exportGlobals ??
          this.#vscode?.exportGlobals ??
          this.#vite?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          this.#top.cssModules?.generateScopedName ??
          this.#vscode?.generateScopedName ??
          this.#vite?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          this.#top.cssModules?.hashPrefix ??
          this.#vscode?.hashPrefix ??
          this.#vite?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          this.#top.cssModules?.localsConvention ??
          this.#vscode?.localsConvention ??
          this.#vite?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsHeader:
          this.#top.cssModules?.dtsHeader ??
          this.#vscode?.dtsHeader ??
          defaultOptions.cssModules.dtsHeader,
        dtsFooter:
          this.#top.cssModules?.dtsFooter ??
          this.#vscode?.dtsFooter ??
          defaultOptions.cssModules.dtsFooter,
        generateDtsOnSave:
          this.#top.cssModules?.generateDtsOnSave ??
          this.#vscode?.generateDtsOnSave ??
          defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          this.#top.cssModules?.modulePattern ??
          this.#vscode?.modulePattern ??
          defaultOptions.cssModules.modulePattern,
        extensions:
          this.#top.cssModules?.extensions ??
          this.#vscode?.extensions ??
          defaultOptions.cssModules.extensions,
      },
    };
  }

  private async readOptions(): Promise<void> {
    const options = this.compileOptions();

    if (!deepEquals(options, this.#options)) {
      this.#options = options;
      this.#eventTarget.dispatchEvent(new Event('change'));
    }
    this.#logger = this.buildLogger();
  }

  private buildLogger(): Logger {
    return {
      trace: loggerOutput('trace', this.#options.logLevel, this.#baseLogger.trace),
      debug: loggerOutput('debug', this.#options.logLevel, this.#baseLogger.debug),
      info: loggerOutput('info', this.#options.logLevel, this.#baseLogger.info),
      warn: loggerOutput('warn', this.#options.logLevel, this.#baseLogger.warn),
      error: loggerOutput('error', this.#options.logLevel, this.#baseLogger.error),
    };
  }

  public get logger(): Logger {
    return this.#logger;
  }

  public get options(): Options {
    return this.#options;
  }

  public get globIsCss(): string {
    const { modulePattern, extensions } = this.#options.cssModules;

    if (extensions.length === 0) {
      return modulePattern;
    } else if (extensions.length === 1) {
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

  public onDidChange(listener: () => void): void {
    this.#listeners.add(listener);
    this.#eventTarget.addEventListener('change', listener);
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.#watcher) {
      for (const watcher of Array.from(this.#watcher)) {
        await watcher.close();
        this.#watcher.delete(watcher);
      }
    }

    for (const listener of this.#listeners) {
      this.#eventTarget.removeEventListener('change', listener);
    }
  }
}
