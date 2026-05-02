import fs from 'node:fs';

import postcss, { type AcceptedPlugin, type Parser, type Root } from 'postcss';
import postcssComment from 'postcss-comment';
import postcssImport from 'postcss-import';
import postcssLocalByDefault from 'postcss-modules-local-by-default';
import postcssModulesScope from 'postcss-modules-scope';

const defaultPlugins: AcceptedPlugin[] = [
  postcssImport() as AcceptedPlugin,
  postcssLocalByDefault as AcceptedPlugin,
  postcssModulesScope as AcceptedPlugin,
];

/**
 * Extracts class names from a CSS module file.
 *
 * This function processes a CSS module file through PostCSS with CSS Modules plugins
 * to identify and extract all exported class names. It uses the following PostCSS plugins:
 * - postcss-import: Resolves \@import statements
 * - postcss-modules-local-by-default: Makes classes local by default
 * - postcss-modules-scope: Adds scoping to local classes
 * - postcss-comment: Parses CSS comments
 *
 * The function looks for the `:export` pseudo-selector that CSS Modules uses to
 * define the mapping between original class names and their transformed versions.
 *
 * @param filePath - The absolute path to the CSS module file to process
 * @returns A promise that resolves to a Set of class name strings exported by the CSS module
 *
 * @throws Will reject if the file cannot be read or if PostCSS processing fails
 *
 * @example
 * ```typescript
 * // Given a file 'styles.module.css' with content:
 * // .button { color: blue; }
 * // .header { font-size: 2em; }
 *
 * const classNames = await extractClassnames('./styles.module.css');
 * // classNames: Set { 'button', 'header' }
 * ```
 *
 * @example
 * ```typescript
 * // With \@import and nested selectors
 * const classNames = await extractClassnames('./complex.module.css');
 * // Returns all local class names after processing imports
 * ```
 *
 * @group CSS Modules
 * @category Class Extraction
 */
export async function extractClassnames(filePath: string): Promise<Set<string>> {
  const exportTokens: Set<string> = new Set();

  const gatherPlugin = (root: Root): void => {
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

  return new Promise<Set<string>>((resolve, reject) => {
    fs.promises
      .readFile(filePath, 'utf-8')
      .then(async (source) => {
        await postcss([...defaultPlugins, gatherPlugin as AcceptedPlugin]).process(source, {
          from: filePath,
          parser: postcssComment as Parser,
        });
        resolve(exportTokens);
      })
      .catch(reject);
  });
}
