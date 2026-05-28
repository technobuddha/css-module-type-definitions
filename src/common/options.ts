import { empty } from '@technobuddha/library';
import {
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

// interface PostcssOptions {
//   excludePlugins?: string[];
//   useConfig?: boolean;
// }

export interface Options {
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
    generateScopedName: string;
    hashPrefix: string;
    localsConvention: 'camelCase' | 'camelCaseOnly' | 'dashes' | 'dashesOnly';
    extensions: string[];
    modulePattern: string;
    dtsBanner: boolean;
    dtsHeader: string;
    dtsFooter: string;
    generateDtsOnSave: boolean;
  };
}

export const defaultOptions = Object.freeze<Options>({
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
    dtsBanner: true,
    dtsHeader:
      '// cspell:disable\n/* eslint eslint-comments/no-unlimited-disable: "off" */\n/* eslint-disable */',
    dtsFooter: empty,
    generateDtsOnSave: true,
    extensions: ['css', 'less', 'sass', 'scss', 'styl', 'stylus'],
    modulePattern: '*.module',
  },
});
