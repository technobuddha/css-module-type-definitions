import { type DotenvConfigOptions } from '@dotenvx/dotenvx';
import { empty } from '@technobuddha/library';
import {
  type CSSModulesOptions,
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

interface PostcssOptions {
  excludePlugins?: string[];
  useConfig?: boolean;
}

export interface Options {
  dotenv?: Omit<DotenvConfigOptions, 'path'> & { path?: string };
  goToDefinition?: boolean;
  postcss?: PostcssOptions;
  preprocessor?: {
    less?: NonNullable<LessPreprocessorOptions>;
    sass?: SassPreprocessorOptions;
    scss?: SassPreprocessorOptions;
    styl?: StylusPreprocessorOptions;
    stylus?: StylusPreprocessorOptions;
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
