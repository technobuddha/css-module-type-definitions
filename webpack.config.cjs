/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const path = require('path');
const { builtinModules } = require('module');

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

/**
 * @param {string | undefined} request
 * @returns {boolean}
 */
function isNodeBuiltinImport(request) {
  return request != null && nodeBuiltins.has(request);
}

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './src/vscode-extension/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: { // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
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
        request === 'esbuild'
        || request?.startsWith('esbuild/')
        || request === 'rolldown'
        || request?.startsWith('rolldown/')
        || request?.startsWith('@rolldown/')
        // || request?.startsWith('@vitejs/')
      ) {
        return callback(null, `commonjs ${request}`);
      }

      if (isNodeBuiltinImport(request)) {
        return callback(null, `commonjs ${request}`);
      }

      return callback();
    }
  ],
  resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js', '.json'],
    extensionAlias: {
      '.js': ['.js', '.ts']
    }
  },
  ignoreWarnings: [
    {
      module: /src[\\/]vscode-extension[\\/]controllers[\\/]configuration-controller\.ts$/,
      message: /Critical dependency: the request of a dependency is an expression/
    },
    {
      module: /node_modules[\\/]/,
      message: /Critical dependency: (the request of a dependency is an expression|require function is used in a way in which dependencies can(?:not| not) be statically extracted)/,
    },
    {
      module: /node_modules[\\/]tsconfig-paths[\\/]/,
      message: /require\.extensions is not supported by webpack\. Use a loader instead\./,
    }
  ],
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: [{
        loader: 'ts-loader',
        options: {
          compilerOptions: {
            "rewriteRelativeImportExtensions": true, // rewrite TypeScript relative import extensions to .js in emitted code.
            "module": "esnext" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
          }
        }
      }]
    }]
  },
}

module.exports = config;
