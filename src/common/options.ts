import { empty } from '@technobuddha/library';
import {
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  // type StylusPreprocessorOptions,
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

export type SeverityLevel = 'error' | 'warning' | 'information' | 'none';

type CMTDLessPreprocessorOptions = Omit<
  LessPreprocessorOptions,
  | 'sourceMap'
  | 'filename'
  | 'paths'
  | 'lint'
  | 'compress' // deprecated
  | 'color' // deprecated
  | 'ieCompat' // deprecated
  | 'javascriptEnabled' // deprecated
  | 'dumpLineNumbers'
  | 'rootpath'
  | 'silent'
  | 'syncImport'
>;

type CMTDSassPreprocessorOptions = Omit<
  SassPreprocessorOptions,
  'importers' | 'importer' | 'loadPaths' | 'sourceMap' | 'syntax' | 'url'
>;

// type CMTDStylusPreprocessorOptions = Omit<
//   StylusPreprocessorOptions,
//   'imports' | 'paths' | 'filename' | 'Evaluator'
// >;

export interface Options {
  css: {
    preprocessor: {
      less: CMTDLessPreprocessorOptions;
      sass: CMTDSassPreprocessorOptions;
      scss: CMTDSassPreprocessorOptions;
      // styl: CMTDStylusPreprocessorOptions;
      // stylus: CMTDStylusPreprocessorOptions;
    };
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
  logLevel: LogLevel;
  unusedClassesDiagnostics: SeverityLevel;
  unusedImportedClassesDiagnostics: boolean;
}

export type CMTDOptions = {
  css?: {
    preprocessor?: Partial<Options['css']['preprocessor']>;
    modules?: Partial<Options['css']['modules']>;
  } & Partial<Omit<Options['css'], 'modules' | 'preprocessor'>>;
};

export type PartialOptions = CMTDOptions & {
  logLevel?: Options['logLevel'];
  unusedClassesDiagnostics?: Options['unusedClassesDiagnostics'];
  unusedImportedClassesDiagnostics?: Options['unusedImportedClassesDiagnostics'];
};

export const defaultOptions = Object.freeze<Options>({
  css: {
    preprocessor: {
      less: {},
      sass: {},
      scss: {},
    },
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
  logLevel: 'info',
  unusedClassesDiagnostics: 'warning',
  unusedImportedClassesDiagnostics: false,
});
