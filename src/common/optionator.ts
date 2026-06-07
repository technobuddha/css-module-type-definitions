import path from 'node:path';

import { empty } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { type ResolvedConfig, type UserConfig } from 'vite';

import { type Logger } from './logger.ts';
import { defaultOptions, type Options } from './options.ts';
import { readViteConfig, transformViteConfig, type ViteCss } from './read-vite-config.ts';
import { readVSCodeSettings } from './read-vscode-settings.ts';
import { VITE_EXTENSIONS } from './vite.ts';

type OptionatorOptions = {
  logger?: Logger;
  watch?: boolean;
  vite?: UserConfig | ResolvedConfig;
};

export class Optionator implements AsyncDisposable {
  #top: Partial<Options> = {};
  #options: Options = defaultOptions;
  #watcher: FSWatcher | undefined;
  readonly #logger: Logger | undefined;
  readonly #watchVite: boolean;
  #vite: ViteCss | undefined;

  public static async create(
    top: Partial<Options> = {},
    { logger, watch = false, vite }: OptionatorOptions = {},
  ): Promise<Optionator> {
    const optionator = new Optionator(watch, logger, vite);
    optionator.#top = top;
    await optionator.readOptions();
    return optionator;
  }

  private constructor(watch = false, logger?: Logger, vite?: UserConfig | ResolvedConfig) {
    this.#logger = logger;
    if (vite) {
      this.#vite = transformViteConfig(vite);
      this.#watchVite = false;
    } else {
      this.#watchVite = watch;
    }

    if (watch) {
      this.#watcher = chokidar.watch('.', {
        ignored: (file, stats) => {
          const { dir, base, name, ext } = path.parse(file);

          return (
            (stats?.isFile() ?? false) &&
            !(
              (this.#watchVite &&
                name === 'vite.config' &&
                VITE_EXTENSIONS.includes(ext) &&
                dir === empty) ||
              (base === 'settings.json' && dir === '.vscode')
            )
          );
        },
        ignoreInitial: true,
        persistent: true,
      });

      const respond = (file: string): void => {
        this.#logger?.debug(`${file} changed, reloading options...`);
        void this.readOptions();
      };

      this.#watcher.on('add', respond);
      this.#watcher.on('change', respond);
      this.#watcher.on('unlink', respond);
    }
  }

  private async readOptions(): Promise<void> {
    if (this.#watchVite) {
      this.#vite = await readViteConfig('.', this.#logger);
    }
    const vscode = await readVSCodeSettings(this.#logger);

    this.#options = {
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
          vscode?.scopeBehaviour ??
          this.#vite?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          this.#top.cssModules?.globalModulePaths ??
          vscode?.globalModulePaths ??
          this.#vite?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          this.#top.cssModules?.exportGlobals ??
          vscode?.exportGlobals ??
          this.#vite?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          this.#top.cssModules?.generateScopedName ??
          vscode?.generateScopedName ??
          this.#vite?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          this.#top.cssModules?.hashPrefix ??
          vscode?.hashPrefix ??
          this.#vite?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          this.#top.cssModules?.localsConvention ??
          vscode?.localsConvention ??
          this.#vite?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsBanner:
          this.#top.cssModules?.dtsBanner ??
          vscode?.dtsBanner ??
          defaultOptions.cssModules.dtsBanner,
        dtsHeader:
          this.#top.cssModules?.dtsHeader ??
          vscode?.dtsHeader ??
          defaultOptions.cssModules.dtsHeader,
        dtsFooter:
          this.#top.cssModules?.dtsFooter ??
          vscode?.dtsFooter ??
          defaultOptions.cssModules.dtsFooter,
        generateDtsOnSave:
          this.#top.cssModules?.generateDtsOnSave ??
          vscode?.generateDtsOnSave ??
          defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          this.#top.cssModules?.modulePattern ??
          vscode?.modulePattern ??
          defaultOptions.cssModules.modulePattern,
        extensions:
          this.#top.cssModules?.extensions ??
          vscode?.extensions ??
          defaultOptions.cssModules.extensions,
      },
    };
  }

  public get options(): Options {
    return this.#options;
  }

  public get globIsCss(): string {
    return `${this.#options.cssModules.modulePattern}.{${this.#options.cssModules.extensions.join(',')}}`;
  }

  public get globIsTypeDefinition(): string {
    return `${this.#options.cssModules.modulePattern}.{${this.#options.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.#watcher) {
      await this.#watcher.close();
      this.#watcher = undefined;
    }
  }
}
