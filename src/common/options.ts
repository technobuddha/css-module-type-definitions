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
  readonly logLevel: LogLevel;
  readonly unusedExportsDiagnostics: SeverityLevel;
  readonly multipleTypeExportsDiagnostics: SeverityLevel;
  readonly localAndGlobalExportsDiagnostics: SeverityLevel;

  readonly css: {
    readonly preprocessor: {
      readonly less: CMTDLessPreprocessorOptions;
      readonly sass: CMTDSassPreprocessorOptions;
      readonly scss: CMTDSassPreprocessorOptions;
    };
    readonly modules: {
      readonly scopeBehaviour: 'global' | 'local';
      readonly globalModulePaths: RegExp[];
      readonly exportGlobals: boolean;
      readonly generateScopedName:
        string | ((name: string, filename: string, css: string) => string) | undefined;
      readonly hashPrefix: string;
      readonly localsConvention: LocalsConvention;
    };
    readonly generateDts: boolean;
    readonly dtsHeader: string;
    readonly dtsFooter: string;
    readonly classesConvention: ClassConvention;
  };
}

export type CMTDOptions = {
  css?: {
    readonly preprocessor?: Partial<Options['css']['preprocessor']>;
    readonly modules?: Partial<Options['css']['modules']>;
  } & Partial<Omit<Options['css'], 'modules' | 'preprocessor'>>;
};

export type PartialOptions = CMTDOptions & {
  readonly logLevel?: Options['logLevel'];
  readonly unusedExportsDiagnostics?: Options['unusedExportsDiagnostics'];
  readonly multipleTypeExportsDiagnostics?: Options['multipleTypeExportsDiagnostics'];
  readonly localAndGlobalExportsDiagnostics?: Options['localAndGlobalExportsDiagnostics'];
};

export const defaultOptions = Object.freeze<Options>({
  logLevel: 'info',
  unusedExportsDiagnostics: 'warning',
  multipleTypeExportsDiagnostics: 'warning',
  localAndGlobalExportsDiagnostics: 'error',
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
