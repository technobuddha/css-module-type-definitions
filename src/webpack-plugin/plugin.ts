import { type Compiler, type WebpackPluginInstance } from 'webpack';

import CMTD, { type CMTDOptions } from './index.ts';

export class CMTDWebpackPlugin implements WebpackPluginInstance {
  private readonly cmtd: CMTD;
  private isWatching: boolean;

  public constructor(options: CMTDOptions) {
    this.cmtd = new CMTD(options);
    this.isWatching = false;
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.beforeRun.tap('CMTDWebpackPlugin', (_compilation) => {
      void this.cmtd.scan();
    });

    compiler.hooks.watchRun.tapPromise('CMTDWebpackPlugin', async () => {
      if (this.isWatching) {
        return Promise.resolve();
      }

      this.isWatching = true;
      return this.cmtd.scan().then(() => this.cmtd.watch());
    });
  }
}

export default CMTDWebpackPlugin;
