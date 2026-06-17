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

import { defaultOptions, type Logger, normalizeOptions, type Options } from '../../common/index.ts';

import { SETTINGS_PREFIX } from '../constants.ts';
import { createLogger } from '../create-logger.ts';

import { UriIgnorer } from './uri-ignorer.ts';
import { ViteWatcher } from './vite-watcher.ts';
import { VSDisposable } from './vs-disposable.ts';

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');

function toFilename(filename: string | URI): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export class ConfigurationController extends VSDisposable {
  public readonly logger: Logger = createLogger();
  protected readonly onDidChangeEmitter = new EventEmitter<ConfigurationChangeEvent>();
  protected readonly folderOptions: Map<WorkspaceFolder, Options> = new Map();
  protected readonly folderIgnores: Map<WorkspaceFolder, UriIgnorer> = new Map();
  protected readonly folderVite: Map<WorkspaceFolder, ViteWatcher> = new Map();

  public static async create(): Promise<ConfigurationController> {
    const controller = new ConfigurationController();

    await controller.updateFolders();
    await controller.loadOptions();

    return controller;
  }

  public constructor() {
    super();

    this.disposables.push(
      workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration(SETTINGS_PREFIX)) {
          this.logger.info('Relevant configuration change detected, updating options...');
          await this.loadOptions();
          this.onDidChangeEmitter.fire(event);
        }
      }),
      workspace.onDidChangeWorkspaceFolders(async () => {
        this.logger.info('Workspace folders change detected');
        await this.updateFolders();
        await this.loadOptions();
      }),
    );
  }

  public get onDidChange(): Event<ConfigurationChangeEvent> {
    return this.onDidChangeEmitter.event;
  }

  private async updateFolders(): Promise<void> {
    if (workspace.workspaceFolders) {
      for (const [folder, watcher] of Array.from(this.folderVite.entries())) {
        if (!workspace.workspaceFolders.includes(folder)) {
          await watcher.dispose();
          this.folderVite.delete(folder);
        }
      }

      for (const folder of workspace.workspaceFolders) {
        if (!this.folderVite.has(folder)) {
          const watcher = await ViteWatcher.create({ folder, logger: this.logger });
          this.folderVite.set(folder, watcher);
        }
      }

      for (const ignored of Array.from(this.folderIgnores.keys())) {
        if (!workspace.workspaceFolders.includes(ignored)) {
          await this.folderIgnores.get(ignored)!.dispose();
          this.folderIgnores.delete(ignored);
        }
      }

      for (const folder of workspace.workspaceFolders) {
        if (!this.folderIgnores.has(folder)) {
          this.folderIgnores.set(
            folder,
            await UriIgnorer.create({ folder, logger: this.logger, watch: true }),
          );
        }
      }
    }
  }

  private async loadOptions(): Promise<void> {
    this.folderOptions.clear();

    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        const viteConfig = this.folderVite.get(folder)?.config ?? {};
        const config = workspace.getConfiguration(SETTINGS_PREFIX, folder);

        const options = normalizeOptions({
          logLevel: defaultOptions.logLevel,
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
        });

        this.folderOptions.set(folder, options);
      }
    }
  }

  public options(folder: WorkspaceFolder): Options {
    const options = this.folderOptions.get(folder);
    if (options) {
      return options;
    }
    this.logger.error(`No options found for folder ${folder.name}`);
    return defaultOptions;
  }

  public globIsCss(folder: WorkspaceFolder): string {
    const { modulePattern, extensions } = this.options(folder).cssModules;

    if (extensions.length === 1) {
      return `${modulePattern}.${extensions[0]}`;
    }

    return `${modulePattern}.{${extensions.join(',')}}`;
  }

  public globIsTypeDefinition(folder: WorkspaceFolder): string {
    const { modulePattern, extensions } = this.options(folder).cssModules;

    return `${modulePattern}.{${extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public isIgnored(file: URI): boolean {
    this.logger.warn(`Checking if file is ignored: ${file.toString(true)}`);

    const ws = workspace.getWorkspaceFolder(file);
    if (ws) {
      this.logger.warn(`Found workspace folder for file: ${ws.name}`);
      this.logger.warn(`Ignorer exists for workspace folder: ${this.folderIgnores.has(ws)}`);
      this.logger.warn(
        `Checking if file is ignored by ignorer: ${this.folderIgnores.get(ws)?.isIgnored(file)}`,
      );
      return this.folderIgnores.get(ws)?.isIgnored(file) ?? false;
    }
    return false;
  }

  public async findUnignoredFiles(folder: WorkspaceFolder, glob: string): Promise<URI[]> {
    const result: URI[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(folder, glob))) {
      if (!this.isIgnored(file)) {
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

    for (const [dir, ignorer] of Array.from(this.folderIgnores.entries())) {
      await ignorer.dispose();
      this.folderIgnores.delete(dir);
    }

    for (const [dir, watcher] of Array.from(this.folderVite.entries())) {
      await watcher.dispose();
      this.folderVite.delete(dir);
    }
  }
}

export const config = await ConfigurationController.create();
