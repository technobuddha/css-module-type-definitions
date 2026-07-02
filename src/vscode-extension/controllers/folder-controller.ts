import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import {
  CONFIG_EXTENSIONS,
  defaultOptions,
  fileOperation,
  Ignorer,
  locateViteConfigurationFile,
  type LoggerController,
  type NormalizedOptions,
  normalizeOptions,
  type Options,
  readViteConfig,
  type ViteCss,
} from '../../common/index.ts';
import { locateCMTDConfigurationFile, readCMTDConfig } from '../../common/read-cmtd-config.ts';

// import { SETTINGS_PREFIX } from '../constants.ts';
import { deleteTypes } from '../helpers/delete-types.ts';
import { generateTypes } from '../helpers/generate-types.ts';

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderController extends Ignorer<URI> implements Disposable {
  public static async create({
    folder,
    logger,
  }: FolderControllerOptions): Promise<FolderController> {
    const controller = new FolderController({ folder, logger });

    controller.cmtdConfigFile = await locateCMTDConfigurationFile(folder.uri.fsPath);
    controller.viteConfigFile = await locateViteConfigurationFile(folder.uri.fsPath);

    await controller.loadCMTDConfig();
    await controller.loadViteConfig();
    await controller.loadOptions();

    await super.init(controller);
    await controller.gatherGitIgnores();
    controller.buildIgnored();

    for (const dir of controller.ignored.keys()) {
      controller.logger.debug(
        fileOperation(path.join(folder.uri.fsPath, dir, '.gitignore'), 'configuration'),
      );
    }

    return controller;
  }

  #options = normalizeOptions(defaultOptions);
  private readonly folder: WorkspaceFolder;
  private cmtdConfigFile: string | undefined;
  private cmtdConfig: Options | undefined;
  private viteConfigFile: string | undefined;

  protected readonly disposables: Disposable[] = [];
  protected readonly gitIgnores: Map<string, Ignore> = new Map();
  protected readonly ignored: Map<string, Ignore> = new Map();

  public viteConfig: ViteCss | undefined;

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ root: folder.uri.fsPath, watch: true, logger });
    this.folder = folder;

    const vwatcher = workspace.createFileSystemWatcher(
      new RelativePattern(folder, `vite.config{${CONFIG_EXTENSIONS.join(',')}}`),
    );

    const respond = (_action: 'add' | 'change' | 'unlink') => async () => this.loadViteConfig();

    const gitWatcher = workspace.createFileSystemWatcher(
      new RelativePattern(folder, '**/.gitignore'),
    );

    const pattern = `**/${this.globIsCss()}`;
    const cssWatcher = workspace.createFileSystemWatcher(new RelativePattern(folder, pattern));

    this.disposables.push(
      vwatcher,
      vwatcher.onDidCreate(respond('add')),
      vwatcher.onDidChange(respond('change')),
      vwatcher.onDidDelete(respond('unlink')),

      gitWatcher,
      gitWatcher.onDidChange(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'change'));
        await this.readGitIgnore(uri);
        this.buildIgnored();
      }),
      gitWatcher.onDidCreate(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'add'));
        await this.readGitIgnore(uri);
        this.buildIgnored();
      }),
      gitWatcher.onDidDelete(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'unlink'));
        this.removeGitIgnore(uri);
        this.buildIgnored();
      }),

      cssWatcher,
      cssWatcher.onDidChange(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'change'));
        const options = this.#options;
        if (options.cssModules.generateDtsOnSave && this.isCSS(uri) && !this.isIgnored(uri)) {
          await generateTypes(uri, { options, logger: this.logger });
        }
      }),
      cssWatcher.onDidCreate(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'add'));
        const options = this.#options;
        if (options.cssModules.generateDtsOnSave && this.isCSS(uri) && !this.isIgnored(uri)) {
          await generateTypes(uri, { options, logger: this.logger });
        }
      }),
      cssWatcher.onDidDelete(async (uri) => {
        this.logger.debug(fileOperation(uri.fsPath, 'unlink'));
        if (this.#options.cssModules.generateDtsOnSave && this.isCSS(uri) && !this.isIgnored(uri)) {
          await deleteTypes(uri, { logger: this.logger });
        }
      }),
    );
  }

  private async loadCMTDConfig(): Promise<void> {
    this.cmtdConfig = this.cmtdConfigFile ? await readCMTDConfig(this.cmtdConfigFile) : undefined;
  }

  private async loadViteConfig(): Promise<void> {
    this.viteConfig = this.viteConfigFile ? await readViteConfig(this.viteConfigFile) : undefined;
  }

  private async loadOptions(): Promise<void> {
    this.#options = normalizeOptions({
      logLevel: defaultOptions.logLevel,
      preprocessor: {
        less: {
          ...this.cmtdConfig?.preprocessor?.less,
          ...this.viteConfig?.preprocessorOptions?.less,
          ...defaultOptions.preprocessor.less,
        },
        sass: {
          ...this.cmtdConfig?.preprocessor?.sass,
          ...this.viteConfig?.preprocessorOptions?.sass,
          ...defaultOptions.preprocessor.sass,
        },
        scss: {
          ...this.cmtdConfig?.preprocessor?.scss,
          ...this.viteConfig?.preprocessorOptions?.scss,
          ...defaultOptions.preprocessor.scss,
        },
        styl: {
          ...this.cmtdConfig?.preprocessor?.styl,
          ...this.viteConfig?.preprocessorOptions?.styl,
          ...defaultOptions.preprocessor.styl,
        },
        stylus: {
          ...this.cmtdConfig?.preprocessor?.stylus,
          ...this.viteConfig?.preprocessorOptions?.stylus,
          ...defaultOptions.preprocessor.stylus,
        },
      },
      cssModules: {
        scopeBehaviour:
          this.cmtdConfig?.cssModules?.scopeBehaviour ??
          this.viteConfig?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          this.cmtdConfig?.cssModules?.globalModulePaths ??
          this.viteConfig?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          this.cmtdConfig?.cssModules?.exportGlobals ??
          this.viteConfig?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          this.cmtdConfig?.cssModules?.generateScopedName ??
          this.viteConfig?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          this.cmtdConfig?.cssModules?.hashPrefix ??
          this.viteConfig?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          this.cmtdConfig?.cssModules?.localsConvention ??
          this.viteConfig?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsHeader: this.cmtdConfig?.cssModules?.dtsHeader ?? defaultOptions.cssModules.dtsHeader,
        dtsFooter: this.cmtdConfig?.cssModules?.dtsFooter ?? defaultOptions.cssModules.dtsFooter,
        generateDtsOnSave:
          this.cmtdConfig?.cssModules?.generateDtsOnSave ??
          defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          this.cmtdConfig?.cssModules?.modulePattern ?? defaultOptions.cssModules.modulePattern,
        extensions: this.cmtdConfig?.cssModules?.extensions ?? defaultOptions.cssModules.extensions,
      },
    });

    return undefined;
  }
  // --- //
  private async readGitIgnore(file: URI): Promise<void> {
    try {
      const dir = path.dirname(workspace.asRelativePath(file, false));
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.gitIgnores.set(dir, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
    }
  }

  private removeGitIgnore(file: URI): void {
    const dir = path.dirname(workspace.asRelativePath(file, false));
    this.gitIgnores.delete(dir);
  }

  private async gatherGitIgnores(): Promise<void> {
    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files) {
          await this.readGitIgnore(file);
        }
      });
  }

  protected buildIgnored(): void {
    this.ignored.clear();

    top: for (const [dir, ignored] of Array.from(this.gitIgnores).sort(
      ([a], [b]) => pathDepth(a) - pathDepth(b),
    )) {
      let parent = path.join(dir, '..');
      while (isWithinDirectory('.', parent)) {
        if (this.ignored.has(parent)) {
          const parentIgnored = this.ignored.get(parent)!;

          if (!parentIgnored.ignores(path.join(dir, '.gitignore'))) {
            this.ignored.set(dir, ignore().add(parentIgnored).add(ignored));
          }
          break top;
        }
        parent = path.join(parent, '..');
      }

      this.ignored.set(dir, this.ignorable().add(ignored));
    }
  }

  protected onChange(): void {
    this.buildIgnored();
  }

  public get options(): NormalizedOptions {
    return this.#options;
  }

  public isIgnored(file: URI): boolean {
    const filepath = workspace.asRelativePath(file, false);
    let parent = path.dirname(filepath);

    while (isWithinDirectory('.', parent)) {
      if (this.ignored.has(parent)) {
        return this.ignored.get(parent)!.ignores(filepath);
      }
      parent = path.join(parent, '..');
    }

    return false;
  }

  public async findUnignoredFiles(pattern: string): Promise<URI[]> {
    const result: URI[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(this.folder, pattern))) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }

  // --- //

  public globIsCss(): string {
    const { modulePattern, extensions } = this.#options.cssModules;

    if (extensions.length === 1) {
      return `${modulePattern}.${extensions[0]}`;
    }

    return `${modulePattern}.{${extensions.join(',')}}`;
  }

  public globIsTypeDefinition(): string {
    const { modulePattern, extensions } = this.#options.cssModules;

    return `${modulePattern}.{${extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public isRelative(filename: string | URI): boolean {
    return reIsRelative.test(typeof filename === 'string' ? filename : filename.fsPath);
  }

  public isCSS(filename: URI): boolean {
    const folder = workspace.getWorkspaceFolder(filename);
    if (folder) {
      return path.matchesGlob(Utils.basename(filename), this.globIsCss());
    }
    return false;
  }

  public isRelativeCSS(filename: URI): boolean {
    return this.isRelative(filename) && this.isCSS(filename);
  }

  public override async dispose(): Promise<void> {
    await super.dispose();
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
