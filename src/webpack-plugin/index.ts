import fs from 'node:fs';

import sane from 'sane';

import {
  defaultOptions,
  generateTypes,
  type Options,
  readVSCodeSettings,
} from '../common/index.ts';

export class CMTD {
  private options?: Options;
  private readonly userOptions: Partial<Options>;

  public constructor(options: Partial<Options> = {}) {
    this.userOptions = options;
  }

  private async resolveOptions(): Promise<Options> {
    if (this.options) {
      return this.options;
    }

    return readVSCodeSettings().then((vscodeSettings) => {
      this.options = {
        preprocessor: {
          less: this.userOptions?.preprocessor?.less ?? defaultOptions.preprocessor.less,
          sass: this.userOptions?.preprocessor?.sass ?? defaultOptions.preprocessor.sass,
          scss: this.userOptions?.preprocessor?.scss ?? defaultOptions.preprocessor.scss,
          styl: this.userOptions?.preprocessor?.styl ?? defaultOptions.preprocessor.styl,
          stylus: this.userOptions?.preprocessor?.stylus ?? defaultOptions.preprocessor.stylus,
        },
        cssModules: {
          scopeBehaviour:
            this.userOptions.cssModules?.scopeBehaviour ??
            vscodeSettings.scopeBehaviour ??
            defaultOptions.cssModules.scopeBehaviour,
          globalModulePaths:
            this.userOptions.cssModules?.globalModulePaths ??
            vscodeSettings.globalModulePaths ??
            defaultOptions.cssModules.globalModulePaths,
          exportGlobals:
            this.userOptions.cssModules?.exportGlobals ??
            vscodeSettings.exportGlobals ??
            defaultOptions.cssModules.exportGlobals,
          generateScopedName:
            this.userOptions.cssModules?.generateScopedName ??
            vscodeSettings.generateScopedName ??
            defaultOptions.cssModules.generateScopedName,
          hashPrefix:
            this.userOptions.cssModules?.hashPrefix ??
            vscodeSettings.hashPrefix ??
            defaultOptions.cssModules.hashPrefix,
          localsConvention:
            this.userOptions.cssModules?.localsConvention ??
            vscodeSettings.localsConvention ??
            defaultOptions.cssModules.localsConvention,
          dtsBanner:
            this.userOptions.cssModules?.dtsBanner ??
            vscodeSettings.dtsBanner ??
            defaultOptions.cssModules.dtsBanner,
          dtsHeader:
            this.userOptions.cssModules?.dtsHeader ??
            vscodeSettings.dtsHeader ??
            defaultOptions.cssModules.dtsHeader,
          dtsFooter:
            this.userOptions.cssModules?.dtsFooter ??
            vscodeSettings.dtsFooter ??
            defaultOptions.cssModules.dtsFooter,
          generateDtsOnSave:
            this.userOptions.cssModules?.generateDtsOnSave ??
            vscodeSettings.generateDtsOnSave ??
            defaultOptions.cssModules.generateDtsOnSave,
          modulePattern:
            this.userOptions.cssModules?.modulePattern ??
            vscodeSettings.modulePattern ??
            defaultOptions.cssModules.modulePattern,
          extensions:
            this.userOptions.cssModules?.extensions ??
            vscodeSettings.extensions ??
            defaultOptions.cssModules.extensions,
        },
      };

      return this.options;
    });
  }

  private async generate(filename: string): Promise<void> {
    return generateTypes(filename, { options: await this.resolveOptions(), logger: console });
  }

  public async scan(): Promise<void> {
    const options = await this.resolveOptions();
    const globIsCss = `**/${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;

    for await (const file of fs.promises.glob(globIsCss)) {
      await this.generate(file);
    }
  }

  public async watch(): Promise<void> {
    const options = await this.resolveOptions();
    const globIsCss = `**/${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;

    const DELAY = 10; // Number of milliseconds to delay for file to finish writing

    const watcher = sane(process.cwd(), { glob: globIsCss });

    watcher.on('add', (f) => void this.generate(f));
    watcher.on('change', (f) => setTimeout(() => void this.generate(f), DELAY));
  }
}

export { CMTDWebpackPlugin } from './plugin.ts';
export default CMTD;
