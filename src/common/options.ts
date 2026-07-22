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
  | 'all'
  | 'none'
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
  css: {
    modules: {
      scopeBehaviour: 'global' | 'local';
      globalModulePaths: RegExp[];
      exportGlobals: boolean;
      generateScopedName:
        string | ((name: string, filename: string, css: string) => string) | undefined;
      hashPrefix: string;
      localsConvention: LocalsConvention;
    };
    extensions: string[];
    modulePattern: string;
    dtsHeader: string;
    dtsFooter: string;
    generateDts: boolean;
  };
}

export type PartialOptions = {
  logLevel?: Options['logLevel'];
  preprocessor?: Partial<Options['preprocessor']>;
  css?: {
    modules?: Partial<Options['css']['modules']>;
  } & Partial<Omit<Options['css'], 'modules'>>;
};

type NormalizedCSSModulesOptions = Omit<Options['css']['modules'], 'localsConvention'> & {
  localsConvention?: LocalsConvention;
};

export type NormalizedOptions = Required<Omit<Options, 'css'>> & {
  css: { modules: NormalizedCSSModulesOptions } & Required<Omit<Options['css'], 'modules'>>;
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
  css: {
    modules: {
      scopeBehaviour: 'local',
      globalModulePaths: [],
      exportGlobals: false,
      generateScopedName: undefined,
      hashPrefix: empty,
      localsConvention: 'none',
    },
    dtsHeader: empty,
    dtsFooter: empty,
    generateDts: true,
    extensions: ['css', 'less', 'sass', 'scss', 'styl', 'stylus'],
    modulePattern: '*.module',
  },
});

export function normalizeOptions(options: Options): NormalizedOptions {
  const nOptions: NormalizedOptions = options;

  const extensions = cull(nOptions.css.extensions, { emptyStrings: true });
  if (extensions.length === 0) {
    nOptions.css.extensions = defaultOptions.css.extensions;
  }

  return nOptions;
}
