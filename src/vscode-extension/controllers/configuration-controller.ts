import path from 'node:path/posix';

import { splitLines } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type UserConfig } from 'vite';
import {
  type ConfigurationChangeEvent,
  type Event,
  EventEmitter,
  RelativePattern,
  Uri,
  workspace,
  type WorkspaceFolder,
} from 'vscode';

import { defaultLogger, defaultOptions, type Logger, type Options } from '../../common/index.ts';
import { createLogger } from '../create-logger.ts';
import { SETTINGS_PREFIX } from '../constants.ts';

import { Controller } from './controller.ts';

type ViteCss = Omit<NonNullable<UserConfig['css']>, 'modules'> & {
  modules?: Exclude<NonNullable<UserConfig['css']>['modules'], false>;
};

const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');

function toFilename(filename: string | Uri): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export class ConfigurationController extends Controller {
  private readonly onDidChangeEmitter = new EventEmitter<ConfigurationChangeEvent>();
  public options: Options = defaultOptions;
  public logger: Logger = defaultLogger;
  public globIsCss = `${defaultOptions.cssModules.modulePattern}.{${defaultOptions.cssModules.extensions.join(',')}}`;
  public globIsTypeDefinition = `${defaultOptions.cssModules.modulePattern}.{${defaultOptions.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  public ignores: Map<WorkspaceFolder, Ignore> = new Map();

  public constructor() {
    super();
    this.logger = createLogger();
  }

  public async init(): Promise<void> {
    this.dispose();
    this.disposables.push(
      workspace.onDidChangeConfiguration(async (event) => {
        this.logger.log('Configuration change detected');
        if (event.affectsConfiguration(SETTINGS_PREFIX)) {
          this.logger.log('Relevant configuration change detected, updating options...');
          await this.readOptions();
          this.onDidChangeEmitter.fire(event);
        }
      }),
      workspace.onDidChangeWorkspaceFolders(async () => {
        this.logger.log('Workspace folders change detected');
        await this.readIgnores();
      }),
    );

    await this.readIgnores();
    return this.readOptions();
  }

  public get onDidChange(): Event<ConfigurationChangeEvent> {
    return this.onDidChangeEmitter.event;
  }

  #viteConfig?: ViteCss;
  private async getViteConfig(): Promise<ViteCss> {
    if (this.#viteConfig === undefined) {
      this.logger.log('Reading Vite configuration...');
      this.#viteConfig = {};

      const glob = `vite.config.{js,cjs,mjs,ts,cts,mts}`;
      workspace.findFiles(glob).then(async (files) => {
        for (const file of files) {
          this.logger.log(`Found Vite config file: ${file.fsPath}`);
          try {
            const vite: UserConfig = await import(file.fsPath).then((mod) => mod.default ?? mod);

            if (vite.css?.modules === false) {
              delete vite.css;
            }

            this.#viteConfig = {
              ...this.#viteConfig,
              ...vite,
              modules: { ...this.#viteConfig?.modules, ...vite.css?.modules },
            };
          } catch {}
        }
      });

      if (typeof this.#viteConfig.modules?.generateScopedName === 'function') {
        delete this.#viteConfig.modules.generateScopedName;
      }
      if (typeof this.#viteConfig.modules?.localsConvention === 'function') {
        delete this.#viteConfig.modules.localsConvention;
      }
    }

    return this.#viteConfig;
  }

  private async readIgnores(): Promise<void> {
    this.ignores.clear();

    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        const gitignoreUri = Uri.joinPath(folder.uri, '.gitignore');
        const ig = ignore();
        try {
          ig.add(
            await workspace.fs.readFile(gitignoreUri).then(async (data) =>
              splitLines(await workspace.decode(data))
                .map((line) => line.trim())
                .filter((line) => line.length > 0 && !line.startsWith('#')),
            ),
          );
        } catch {}

        this.ignores.set(folder, ig);
      }
    }
  }

  private async readOptions(): Promise<void> {
    const viteConfig = await this.getViteConfig();
    const config = workspace.getConfiguration(SETTINGS_PREFIX);

    this.options = {
      // customTemplate
      // dotenv
      // gotoDefinition
      // postcss
      preprocessor: {
        less: viteConfig.preprocessorOptions?.less,
        sass: viteConfig.preprocessorOptions?.sass,
        scss: viteConfig.preprocessorOptions?.scss,
        styl: viteConfig.preprocessorOptions?.styl,
        stylus: viteConfig.preprocessorOptions?.stylus,
      },
      cssModules: {
        scopeBehaviour:
          config.get('cssModules.scopeBehaviour') ??
          viteConfig.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          config.get('cssModules.globalModulePaths') ??
          viteConfig.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          config.get('cssModules.exportGlobals') ??
          viteConfig.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          config.get('cssModules.generateScopedName') ??
          viteConfig.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          config.get('cssModules.hashPrefix') ??
          viteConfig.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          config.get('cssModules.localsConvention') ??
          viteConfig.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsBanner: config.get('cssModules.dtsBanner') ?? defaultOptions.cssModules.dtsBanner,
        dtsHeader: config.get('cssModules.dtsHeader') ?? defaultOptions.cssModules.dtsHeader,
        generateDtsOnSave:
          config.get('cssModules.generateDtsOnSave') ?? defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          config.get<string>('cssModules.modulePattern') ?? defaultOptions.cssModules.modulePattern,
        extensions:
          config.get<string[]>('cssModules.extensions') ?? defaultOptions.cssModules.extensions,
      },
    };

    this.globIsCss = `${this.options.cssModules.modulePattern}.{${this.options.cssModules.extensions.join(',')}}`;
    this.globIsTypeDefinition = `${this.options.cssModules.modulePattern}.{${this.options.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;
  }

  public async findUnignoredFiles(glob: string): Promise<Uri[]> {
    const result: Uri[] = [];

    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        const files = await workspace.findFiles(new RelativePattern(folder, glob));

        const ig = this.ignores.get(folder);

        result.push(
          ...(ig ?
            files.filter((uri) => !ig.ignores(path.relative(folder.uri.path, uri.path)))
          : files),
        );
      }
    }

    return result;
  }

  public isRelative(filename: string | Uri): boolean {
    return reIsRelative.test(toFilename(filename));
  }

  public isCSS(filename: string | Uri): boolean {
    const file = toFilename(filename);
    return path.matchesGlob(path.basename(file), this.globIsCss);
  }

  public isRelativeCSS(filename: string | Uri): boolean {
    return this.isRelative(filename) && this.isCSS(filename);
  }
}
