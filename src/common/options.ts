import { empty } from '@technobuddha/library';
import {
  type CSSModulesOptions,
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

// interface PostcssOptions {
//   excludePlugins?: string[];
//   useConfig?: boolean;
// }

export interface Options {
  // dotenv: Omit<DotenvConfigOptions, 'path'> & { path?: string };
  // postcss: PostcssOptions;
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
  cssModules: CSSModulesOptions & {
    extensions: string[];
    modulePattern: string;
    dtsBanner: boolean;
    dtsHeader: string;
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
    dtsHeader: '/* eslint-disable @typescript-eslint/naming-convention */\n// cspell:disable',
    generateDtsOnSave: true,
    extensions: ['css', 'less', 'sass', 'scss', 'styl', 'stylus'],
    modulePattern: '*.module',
  },
});
