/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable unicorn/prefer-module */
import fs from 'node:fs';

import { cosmiconfigSync } from 'cosmiconfig';
import postcss, { type AcceptedPlugin, type Parser, type Root } from 'postcss';

export type ParserReturn = Set<string>;

export async function parser(
  filePath: string,
  cfg: unknown,
  plugins: AcceptedPlugin[] | null = null,
): Promise<ParserReturn> {
  const config: unknown = cfg ?? cosmiconfigSync('postcss').search()?.config ?? {};

  const importer = require('postcss-import')(
    (config as { plugins: { 'postcss-import': AcceptedPlugin } }).plugins['postcss-import'],
  );
  const localByDefault = require('postcss-modules-local-by-default') as AcceptedPlugin;
  const scope = require('postcss-modules-scope') as AcceptedPlugin;
  const comment = require('postcss-comment') as Parser;

  const defaultPlugins = [importer, localByDefault, scope];

  const exportTokens = new Set<string>();

  const gatherPlugIn = (root: Root): void => {
    root.each((node) => {
      if (node.type === 'rule' && node.selector === ':export') {
        node.each((child) => {
          if (child.type === 'decl') {
            exportTokens.add(child.prop);
          }
        });
      }
    });
  };

  return new Promise<ParserReturn>((resolve, reject) => {
    fs.promises
      .readFile(filePath, 'utf-8')
      .then((source) => {
        postcss((plugins ?? defaultPlugins).concat([gatherPlugIn]))
          .process(source, {
            from: filePath,
            parser: comment,
          })
          .then((_result) => resolve(exportTokens))
          .catch(reject);
      })
      .catch(reject);
  });
}

export default parser;
