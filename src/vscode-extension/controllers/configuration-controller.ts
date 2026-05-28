import path from 'node:path/posix';

import {
  type ConfigurationChangeEvent,
  type Event,
  EventEmitter,
  RelativePattern,
  workspace,
  type WorkspaceFolder,
} from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import {
  defaultLogger,
  defaultOptions,
  type Logger,
  type Options,
  readViteConfig,
} from '../../common/index.ts';

import { SETTINGS_PREFIX } from '../constants.ts';
import { createLogger } from '../create-logger.ts';

import { Controller } from './controller.ts';
import { UriIgnorer } from './ingore-controller.ts';

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');
const globViteConfig = `vite.config.{js,cjs,mjs,ts,cts,mts}`;

function toFilename(filename: string | URI): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export class ConfigurationController extends Controller {
  private readonly onDidChangeEmitter = new EventEmitter<ConfigurationChangeEvent>();
  public logger: Logger = defaultLogger;
  readonly #options: Map<WorkspaceFolder, Options> = new Map();
  readonly #ignores: Map<WorkspaceFolder, UriIgnorer> = new Map();

  public constructor() {
    super();
  }

  public async init(): Promise<void> {
    await this.dispose();
    this.logger = await createLogger();

    const viteWatcher = workspace.createFileSystemWatcher(`**/${globViteConfig}`);

    this.disposables.push(
      workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration(SETTINGS_PREFIX)) {
          this.logger.info('Relevant configuration change detected, updating options...');
          await this.readOptions();
          this.onDidChangeEmitter.fire(event);
        }
      }),
      workspace.onDidChangeWorkspaceFolders(async () => {
        this.logger.info('Workspace folders change detected');
        await this.readIgnores();
        await this.readOptions();
      }),

      viteWatcher,
      viteWatcher.onDidChange(async (file) => {
        this.logger.debug(`Vite config changed: ${file.toString(true)}, reloading options`);
        await this.readOptions();
      }),
      viteWatcher.onDidCreate(async (file) => {
        this.logger.debug(`Vite config created: ${file.toString(true)}, reloading options`);
        await this.readOptions();
      }),
      viteWatcher.onDidDelete(async (file) => {
        this.logger.debug(`Vite config deleted: ${file.toString(true)}, reloading options`);
        await this.readOptions();
      }),
    );

    await this.readIgnores();
    return this.readOptions();
  }

  public get onDidChange(): Event<ConfigurationChangeEvent> {
    return this.onDidChangeEmitter.event;
  }

  private async readIgnores(): Promise<void> {
    if (workspace.workspaceFolders) {
      for (const ignored of this.#ignores.keys()) {
        if (!workspace.workspaceFolders.includes(ignored)) {
          await this.#ignores.get(ignored)?.dispose();
          this.#ignores.delete(ignored);
        }
      }

      for (const folder of workspace.workspaceFolders) {
        if (!this.#ignores.has(folder)) {
          this.#ignores.set(
            folder,
            await UriIgnorer.create(folder, { logger: this.logger, watch: true }),
          );
        }
      }
    }
  }

  private async readOptions(): Promise<void> {
    const viteConfig = await readViteConfig(this.logger);

    this.#options.clear();
    for (const folder of workspace.workspaceFolders ?? []) {
      const config = workspace.getConfiguration(SETTINGS_PREFIX, folder);

      const options: Options = {
        preprocessor: {
          less: { ...defaultOptions.preprocessor.less, ...viteConfig?.preprocessorOptions?.less },
          sass: { ...defaultOptions.preprocessor.sass, ...viteConfig?.preprocessorOptions?.sass },
          scss: { ...defaultOptions.preprocessor.scss, ...viteConfig?.preprocessorOptions?.scss },
          styl: { ...defaultOptions.preprocessor.styl, ...viteConfig?.preprocessorOptions?.styl },
          stylus: {
            ...defaultOptions.preprocessor.stylus,
            ...viteConfig?.preprocessorOptions?.stylus,
          },
        },
        cssModules: {
          scopeBehaviour:
            config.get('cssModules.scopeBehaviour') ??
            viteConfig?.modules?.scopeBehaviour ??
            defaultOptions.cssModules.scopeBehaviour,
          globalModulePaths:
            config.get('cssModules.globalModulePaths') ??
            viteConfig?.modules?.globalModulePaths ??
            defaultOptions.cssModules.globalModulePaths,
          exportGlobals:
            config.get('cssModules.exportGlobals') ??
            viteConfig?.modules?.exportGlobals ??
            defaultOptions.cssModules.exportGlobals,
          generateScopedName:
            config.get('cssModules.generateScopedName') ??
            viteConfig?.modules?.generateScopedName ??
            defaultOptions.cssModules.generateScopedName,
          hashPrefix:
            config.get('cssModules.hashPrefix') ??
            viteConfig?.modules?.hashPrefix ??
            defaultOptions.cssModules.hashPrefix,
          localsConvention:
            config.get('cssModules.localsConvention') ??
            viteConfig?.modules?.localsConvention ??
            defaultOptions.cssModules.localsConvention,
          dtsBanner: config.get('cssModules.dtsBanner') ?? defaultOptions.cssModules.dtsBanner,
          dtsHeader: config.get('cssModules.dtsHeader') ?? defaultOptions.cssModules.dtsHeader,
          dtsFooter: config.get('cssModules.dtsFooter') ?? defaultOptions.cssModules.dtsFooter,
          generateDtsOnSave:
            config.get('cssModules.generateDtsOnSave') ??
            defaultOptions.cssModules.generateDtsOnSave,
          modulePattern:
            config.get<string>('cssModules.modulePattern') ??
            defaultOptions.cssModules.modulePattern,
          extensions:
            config.get<string[]>('cssModules.extensions') ?? defaultOptions.cssModules.extensions,
        },
      };

      this.#options.set(folder, options);
    }
  }

  public options(folder: WorkspaceFolder): Options {
    const options = this.#options.get(folder);
    if (options) {
      return options;
    }
    this.logger.error(`No options found for folder ${folder.name}`);
    return defaultOptions;
  }

  public globIsCss(folder: WorkspaceFolder): string {
    const options = this.options(folder);
    return `${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;
  }

  public globIsTypeDefinition(folder: WorkspaceFolder): string {
    const options = this.options(folder);
    return `${options.cssModules.modulePattern}.{${options.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public isIgnored(file: URI, folder?: WorkspaceFolder): boolean {
    this.logger.warn(`Checking if file is ignored: ${file.toString(true)}`);

    const ws = folder ?? workspace.getWorkspaceFolder(file);
    if (ws) {
      this.logger.warn(`Found workspace folder for file: ${ws.name}`);
      this.logger.warn(`Ignorer exists for workspace folder: ${this.#ignores.has(ws)}`);
      this.logger.warn(
        `Checking if file is ignored by ignorer: ${this.#ignores.get(ws)?.isIgnored(file)}`,
      );
      return this.#ignores.get(ws)?.isIgnored(file) ?? false;
    }
    return false;
  }

  public async findUnignoredFiles(folder: WorkspaceFolder, glob: string): Promise<URI[]> {
    const result: URI[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(folder, glob))) {
      if (!this.isIgnored(file, folder)) {
        result.push(file);
      }
    }

    return result;
  }

  public isRelative(filename: string | URI): boolean {
    return reIsRelative.test(toFilename(filename));
  }

  public isCSS(filename: URI): boolean {
    const folder = workspace.getWorkspaceFolder(filename);
    if (folder) {
      return path.matchesGlob(Utils.basename(filename), this.globIsCss(folder));
    }
    return false;
  }

  public isRelativeCSS(filename: URI): boolean {
    return this.isRelative(filename) && this.isCSS(filename);
  }

  public override async dispose(): Promise<void> {
    await super.dispose();
    for (const ignorer of this.#ignores.values()) {
      await ignorer.dispose();
    }
    this.#ignores.clear();
  }
}
