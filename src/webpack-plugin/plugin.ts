import { type Compiler, type WebpackPluginInstance } from 'webpack';

import { defaultLogger, FileIgnorer, Optionator, type Options,watch } from '../common/index.ts';

export class CMTDWebpackPlugin implements WebpackPluginInstance {
  readonly #options: Partial<Options> | undefined;

  public constructor(options?: Partial<Options>) {
    this.#options = options;
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.initialize.tap('CMTD', () => {
      (async () => {
        const ignorer = new FileIgnorer('.', { watch: true, logger: defaultLogger });
        const optionator = await Optionator.create(this.#options, {
          logger: defaultLogger,
          watch: true,
        });

        void watch({ optionator, ignorer, logger: defaultLogger });
      })();
    });
  }
}
