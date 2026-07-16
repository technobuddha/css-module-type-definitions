import { builtinModules } from 'node:module';
import path from 'node:path';

import { type Configuration } from 'webpack';

const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

function isNodeBuiltin(request: string): boolean {
  return request != null && nodeBuiltins.has(request);
}

const config: Configuration = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './src/vscode-extension/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(import.meta.dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  optimization: {
    sideEffects: true,
    usedExports: true,
    providedExports: true,
    concatenateModules: true,
    mangleExports: 'deterministic',
  },
  externals: [
    ({ request }, callback) => {
      if (request === 'vscode') {
        return callback(null, 'commonjs vscode');
      }

      if (
        // request === 'vite'
        // || request?.startsWith('vite/') ||
        request === 'esbuild' ||
        request?.startsWith('esbuild/') ||
        request === 'rolldown' ||
        request?.startsWith('rolldown/') ||
        request?.startsWith('@rolldown/') ||
        request === 'stylus' ||
        request?.startsWith('stylus/')
        // || request?.startsWith('@vitejs/')
      ) {
        return callback(null, `commonjs ${request}`);
      }

      if (isNodeBuiltin(request)) {
        return callback(null, `commonjs ${request}`);
      }

      return callback();
    },
  ],
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js', '.json'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
  },
  ignoreWarnings: [
    {
      module: /src(?:\\|\/)vscode-extension(?:\\|\/)controllers(?:\\|\/)workspace-controller\.ts$/v,
      message: /Critical dependency: the request of a dependency is an expression/v,
    },
    {
      module: /node_modules(?:\\|\/)/v,
      message:
        /Critical dependency: (the request of a dependency is an expression|require function is used in a way in which dependencies can(?:not| not) be statically extracted)/v,
    },
    {
      module: /node_modules(?:\\|\/)tsconfig-paths(?:\\|\/)/v,
      message: /require\.extensions is not supported by webpack\. Use a loader instead\./v,
    },
  ],
  module: {
    rules: [
      {
        test: /\.ts$/v,
        exclude: /node_modules/v,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                rewriteRelativeImportExtensions: true, // rewrite TypeScript relative import extensions to .js in emitted code.
                module: 'esnext', // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
              },
            },
          },
        ],
      },
    ],
  },
};

export default config;
