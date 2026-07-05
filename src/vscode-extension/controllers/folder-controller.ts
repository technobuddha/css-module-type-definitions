import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, Uri, workspace, type WorkspaceFolder } from 'vscode';
import { Utils } from 'vscode-uri';

import {
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
import { type CssInfo, generateTypesFromCss } from '../../css-library/generate-types-from-css.ts';

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderController extends Ignorer<Uri> implements Disposable {
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
  readonly #types: Map<string, CssInfo> = new Map();
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

    const watcher = workspace.createFileSystemWatcher(new RelativePattern(folder, '**/*'));

    const respond = (action: 'add' | 'change' | 'unlink') => async (uri: Uri) => {
      if (this.isIgnored(uri)) {
        return;
      }

      if (uri.fsPath === this.viteConfigFile) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        await this.loadViteConfig();
        await this.loadOptions();
        await this.getAllTypes();
        return;
      }

      if (uri.fsPath === this.cmtdConfigFile) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        await this.loadCMTDConfig();
        await this.loadOptions();
        await this.getAllTypes();
        return;
      }

      if (Utils.basename(uri) === '.gitignore') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          this.removeGitIgnore(uri);
        } else {
          await this.readGitIgnore(uri);
        }
        this.buildIgnored();
        return;
      }

      if (this.isCssModule(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          await this.deleteTypes(uri);
        } else {
          await this.getTypes(uri, false);
        }
        return;
      }

      if (this.isCss(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        for (const [file, { includedFiles }] of this.#types) {
          if (includedFiles.has(uri.fsPath)) {
            await this.getTypes(Uri.parse(file), false);
          }
        }
      }
    };

    this.disposables.push(
      watcher,
      watcher.onDidCreate(respond('add')),
      watcher.onDidChange(respond('change')),
      watcher.onDidDelete(respond('unlink')),
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
        generateDts:
          this.cmtdConfig?.cssModules?.generateDts ?? defaultOptions.cssModules.generateDts,
        modulePattern:
          this.cmtdConfig?.cssModules?.modulePattern ?? defaultOptions.cssModules.modulePattern,
        extensions: this.cmtdConfig?.cssModules?.extensions ?? defaultOptions.cssModules.extensions,
      },
    });

    return undefined;
  }

  private async readGitIgnore(file: Uri): Promise<void> {
    try {
      const dir = path.dirname(workspace.asRelativePath(file, false));
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.gitIgnores.set(dir, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
    }
  }

  private removeGitIgnore(file: Uri): void {
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

  public async getTypes(uri: Uri, cache = true): Promise<CssInfo | undefined> {
    if (cache && this.#types.has(uri.fsPath)) {
      return this.#types.get(uri.fsPath)!;
    }

    const { logger, options } = this;

    if (this.isCssModule(uri) && !this.isIgnored(uri)) {
      try {
        const result = await workspace.fs
          .readFile(uri)
          .then(workspace.decode)
          .then(async (content) => generateTypesFromCss(content, uri.fsPath, { options, logger }));

        if (result) {
          if (options.cssModules.generateDts) {
            const { files } = result;
            await Promise.all(
              Object.entries(files).map(async ([filename, content]) => {
                const fileUri = uri.with({ path: filename });

                try {
                  await workspace.fs
                    .readFile(fileUri)
                    .then(workspace.decode)
                    .then(async (existingContent) => {
                      if (existingContent !== content) {
                        await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                        logger.info(fileOperation(filename, 'updated'));
                      }
                    });
                } catch (e) {
                  const error = toError(e);
                  if (error.code === 'FileNotFound') {
                    await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                    logger.info(fileOperation(filename, 'created'));
                  } else {
                    logger.error(error, `Failed to read file ${fileUri.fsPath}`);
                  }
                }
              }),
            );
          }

          this.#types.set(uri.fsPath, result);
          return result;
        }
        this.#types.delete(uri.fsPath);
        return undefined;
      } catch (e) {
        logger.error(toError(e));
      }
    }
    return undefined;
  }

  public async getAllTypes(): Promise<void> {
    const { logger, options } = this;

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.getTypes(uri, false);
        if (result && options.cssModules.generateDts) {
          for (const file of Object.keys(result.files)) {
            typedefs.delete(file);
          }
        }
      }
    });

    for (const pathname of typedefs) {
      await workspace.fs.delete(Uri.parse(pathname));
      logger.info(fileOperation(pathname, 'deleted'));
    }
  }

  public async deleteTypes(uri: Uri): Promise<void> {
    const { dir, name, ext } = path.parse(uri.fsPath);

    this.#types.delete(uri.fsPath);

    for (const file of [
      `${name}.d${ext}.ts`,
      `${name}${ext}.d.ts`,
      `${name}${ext}.map`,
      `${name}.d${ext}.ts.map`,
      `${name}${ext}.d.ts.map`,
    ]) {
      const generatedUri = uri.with({ path: path.join(dir, file) });
      try {
        await workspace.fs.delete(generatedUri).then(() => {
          this.logger.debug(fileOperation(generatedUri.fsPath, 'deleted'));
        });
      } catch {}
    }
  }

  public async deleteAllTypes(): Promise<void> {
    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.deleteTypes(uri);
      }
    });
    await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`).then(async (uris) => {
      for (const uri of uris) {
        await workspace.fs.delete(uri);
        this.logger.info(fileOperation(uri.fsPath, 'deleted'));
      }
    });
  }

  public isIgnored(file: Uri): boolean {
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

  public async findUnignoredFiles(pattern: string): Promise<Uri[]> {
    const result: Uri[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(this.folder, pattern))) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
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
