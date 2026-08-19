import { defaultBanner, empty, space } from '@technobuddha/library';
import { type LessPreprocessorOptions, type SassPreprocessorOptions } from 'vite';

import { BANNER_MESSAGE } from './banner-message.ts';
import { type LogLevel } from './logger.ts';

type LocalsConvention =
  | 'camelCase'
  | 'camelCaseOnly'
  | 'dashes'
  | 'dashesOnly'
  | 'all'
  | 'none'
  | ((originalClassName: string, generatedClassName: string, inputFile: string) => string);

export const CLASSCONVENTIONS = ['kebabCase', 'none'] as const;
type ClassConvention = (typeof CLASSCONVENTIONS)[number];

export const SEVERITYLEVELS = ['error', 'warning', 'information', 'none'] as const;

export type SeverityLevel = (typeof SEVERITYLEVELS)[number];

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

export interface Options {
  logLevel: LogLevel;
  unusedClassesDiagnostics: SeverityLevel;
  unusedImportedClassesDiagnostics: boolean;

  css: {
    preprocessor: {
      less: CMTDLessPreprocessorOptions;
      sass: CMTDSassPreprocessorOptions;
      scss: CMTDSassPreprocessorOptions;
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
    generateDts: boolean;
    dtsHeader: string;
    dtsFooter: string;
    classesConvention: ClassConvention;
  };
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
  logLevel: 'info',
  unusedClassesDiagnostics: 'warning',
  unusedImportedClassesDiagnostics: false,
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
    dtsHeader: [
      '// cspell:disable',
      '/* eslint eslint-comments/no-unlimited-disable: "off" */',
      '/* eslint-disable */',
      '{',
      ...defaultBanner(BANNER_MESSAGE).map((line) => `${space.repeat(2)}// ${line}`),
      '}',
      empty,
      '// prettier-ignore',
    ].join('\n'),
    dtsFooter: empty,
    generateDts: true,
    classesConvention: 'none',
  },
});

export function defineConfig(options: CMTDOptions): CMTDOptions {
  return options;
}
