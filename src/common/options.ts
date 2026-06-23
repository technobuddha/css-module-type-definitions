import { cull, empty } from '@technobuddha/library';
import {
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

import { type LogLevel } from './logger.ts';

type LocalsConvention =
  | 'camelCase'
  | 'camelCaseOnly'
  | 'dashes'
  | 'dashesOnly'
  | ((originalClassName: string, generatedClassName: string, inputFile: string) => string);

export interface Options {
  logLevel: LogLevel;
  preprocessor: {
    less: LessPreprocessorOptions;
    sass: Omit<
      SassPreprocessorOptions,
      'importers' | 'importer' | 'loadPaths' | 'sourceMap' | 'syntax' | 'url'
    >;
    scss: Omit<
      SassPreprocessorOptions,
      'importers' | 'importer' | 'loadPaths' | 'sourceMap' | 'syntax' | 'url'
    >;
    styl: StylusPreprocessorOptions;
    stylus: StylusPreprocessorOptions;
  };
  cssModules: {
    scopeBehaviour: 'global' | 'local';
    globalModulePaths: RegExp[];
    exportGlobals: boolean;
    generateScopedName:
      | string
      | ((name: string, filename: string, css: string) => string)
      | undefined;
    hashPrefix: string;
    localsConvention: LocalsConvention | 'asIs';
    extensions: string[];
    modulePattern: string;
    dtsHeader: string;
    dtsFooter: string;
    generateDtsOnSave: boolean;
  };
}

export type PartialOptions = {
  logLevel?: Options['logLevel'];
  preprocessor?: Partial<Options['preprocessor']>;
  cssModules?: Partial<Options['cssModules']>;
};

type NormalizedCSSModulesOptions = Omit<Options['cssModules'], 'localsConvention'> & {
  localsConvention?: LocalsConvention;
};

export type NormalizedOptions = Omit<Options, 'cssModules'> & {
  cssModules: NormalizedCSSModulesOptions;
};

export const defaultOptions = Object.freeze<Options>({
  logLevel: 'info',
  preprocessor: {
    less: {},
    sass: {},
    scss: {},
    styl: {},
    stylus: {},
  },
  cssModules: {
    scopeBehaviour: 'local',
    globalModulePaths: [],
    exportGlobals: false,
    generateScopedName: undefined,
    hashPrefix: empty,
    localsConvention: 'asIs',
    dtsHeader: empty,
    dtsFooter: empty,
    generateDtsOnSave: true,
    extensions: ['css', 'less', 'sass', 'scss', 'styl', 'stylus'],
    modulePattern: '*.module',
  },
});

export function normalizeOptions(options: Options): NormalizedOptions {
  const nOptions: NormalizedOptions = options as NormalizedOptions;

  const extensions = cull(nOptions.cssModules.extensions, { emptyStrings: true });
  if (extensions.length === 0) {
    nOptions.cssModules.extensions = defaultOptions.cssModules.extensions;
  }
  if (
    options.cssModules.localsConvention === 'asIs' ||
    options.cssModules.localsConvention === undefined
  ) {
    delete nOptions.cssModules.localsConvention;
  }

  return nOptions;
}
