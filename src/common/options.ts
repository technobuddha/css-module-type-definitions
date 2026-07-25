import { empty } from '@technobuddha/library';
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

type ClassConvention = 'kebabCase' | 'none';

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
    dtsHeader: string;
    dtsFooter: string;
    generateDts: boolean;
    classesConvention: ClassConvention;
  };
}

export type PartialOptions = {
  logLevel?: Options['logLevel'];
  preprocessor?: Partial<Options['preprocessor']>;
  css?: {
    modules?: Partial<Options['css']['modules']>;
  } & Partial<Omit<Options['css'], 'modules'>>;
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
    classesConvention: 'none',
  },
});
