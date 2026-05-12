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
    less?: LessPreprocessorOptions;
    sass?: SassPreprocessorOptions;
    scss?: SassPreprocessorOptions;
    styl?: StylusPreprocessorOptions;
    stylus?: StylusPreprocessorOptions;
  };
  cssModules?: CSSModulesOptions & {
    filePattern?: string;
    dtsBanner?: boolean;
    dtsHeader?: string;
    generateDtsOnSave?: boolean;
  };
}

export const defaultOptions: Options = {
  cssModules: {
    scopeBehaviour: 'local',
    globalModulePaths: [],
    exportGlobals: true,
    generateScopedName: '[name]__[local]___[hash:base64:5]',
    hashPrefix: empty,
    localsConvention: 'camelCase',
    filePattern: '\\.module\\.(?:css|less|sass|scss|styl(?:us)?)$',
    dtsBanner: true,
    dtsHeader: '/* eslint-disable @typescript-eslint/naming-convention */\n// cspell:disable',
    generateDtsOnSave: true,
  },
};
