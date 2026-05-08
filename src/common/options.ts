import { type DotenvConfigOptions } from '@dotenvx/dotenvx';
import {
  type CSSModulesOptions,
  type LessPreprocessorOptions,
  type SassPreprocessorOptions,
  type StylusPreprocessorOptions,
} from 'vite';

import { type Logger } from '../css-library/logger.ts';

interface PostcssOptions {
  excludePlugins?: string[];
  useConfig?: boolean;
}

export interface Options {
  customTemplate?: string;
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
  cssModules?: CSSModulesOptions;
  cssPattern?: string;
}

interface CustomTemplateOptions {
  //classes: CSSExports;
  filename: string;
  logger: Logger;
}

export type CustomTemplate = (dts: string, options: CustomTemplateOptions) => string;
