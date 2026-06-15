import { empty } from '@technobuddha/library';
import {
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

import { type LogLevel } from './logger.ts';

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
    generateScopedName: string | ((name: string, filename: string, css: string) => string);
    hashPrefix: string;
    localsConvention:
      | 'camelCase'
      | 'camelCaseOnly'
      | 'dashes'
      | 'dashesOnly'
      | ((originalClassName: string, generatedClassName: string, inputFile: string) => string);
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
    exportGlobals: true,
    generateScopedName: '[name]__[local]___[hash:base64:5]',
    hashPrefix: empty,
    localsConvention: 'camelCase',
    dtsHeader: empty,
    dtsFooter: empty,
    generateDtsOnSave: true,
    extensions: [], //['css', 'less', 'sass', 'scss', 'styl', 'stylus'],
    modulePattern: '*.module',
  },
});
