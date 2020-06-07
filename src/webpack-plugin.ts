import webpack                  from 'webpack';
import CMTD, { CMTDOptions }    from './index';

export class CMTDWebpackPlugin implements webpack.Plugin
{
    private cmtd:       CMTD;
    private isWatching: boolean;

    constructor(options: CMTDOptions)
    {
        this.cmtd       = new CMTD(options);
        this.isWatching = false;
    }

    public apply(compiler: webpack.Compiler)
    {
        compiler.hooks.beforeRun.tap
        (
            'CMTDWebpackPlugin',
            (_compilation, _callback) =>
            {
                this.cmtd.scan();
            }
        );

        compiler.hooks.watchRun.tapPromise
        (
            'CMTDWebpackPlugin',
            () =>
            {
                if (this.isWatching)
                    return Promise.resolve();
                else
                {
                    this.isWatching = true;
                    return this.cmtd.scan().then(() => this.cmtd.watch());
                }
            }
        );
    }
}

export default CMTDWebpackPlugin;
