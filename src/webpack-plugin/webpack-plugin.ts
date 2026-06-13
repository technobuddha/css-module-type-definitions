import { locatePackageRoot } from '@technobuddha/library';
import { type Compiler, type WebpackPluginInstance } from 'webpack';

import { FileIgnorer, Optionator, type Options, watch } from '../common/index.ts';

export class CMTDWebpackPlugin implements WebpackPluginInstance {
  readonly #options: Partial<Options> | undefined;

  public constructor(options?: Partial<Options>) {
    this.#options = options;
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.initialize.tap('CMTD', () => {
      (async () => {
        const root = (await locatePackageRoot()) ?? process.cwd();
        const optionator = await Optionator.create(this.#options, {
          watch: true,
        });
        const ignorer = await FileIgnorer.create({ root, logger: optionator.logger, watch: true });

        void watch({ root, optionator, ignorer });
      })();
    });
  }
}
