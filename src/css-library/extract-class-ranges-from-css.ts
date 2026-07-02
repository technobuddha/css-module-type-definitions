import path from 'node:path';

import { splitLines, unindent } from '@technobuddha/library';
import postcss, { AtRule, type Node, Rule } from 'postcss';
import postcssImport from 'postcss-import';
import selectorParser from 'postcss-selector-parser';
import { type RawSourceMap, SourceMapConsumer } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger, type NormalizedOptions, removeInlineSourceMap } from '../common/index.ts';

import { getPositionOfOffset, type Position, positionAdd } from './position.ts';
import { fixSourceMap, originalPosition } from './source-map.ts';
import { transformer } from './transformers/transformer.ts';

type ClassPosition = {
  name: string;
  offset: Position;
};

type ExtractClassRangesFromCssArguments = {
  options: NormalizedOptions;
  file: string;
  compilerOptions?: CompilerOptions;
  logger: Logger;
};

export type ExtractedCss = {
  css: string;
  source: string;
  start: Position;
};
type ExtractClassRangesFromCssReturn = {
  css: string;
  sourceMap: RawSourceMap | undefined;
  classes: Map<string, ExtractedCss>;
};
/**
 * Extracts exported class-like identifiers and their source offsets from CSS content.
 *
 * The returned map includes:
 * - Class selectors (e.g. `.button`)
 * - `@value` declarations/import aliases
 * - `@keyframes` names
 *
 * When the same name appears multiple times, only the first occurrence is retained.
 *
 * @param css - The CSS source text to analyze.
 * @param options - Extraction options including the source filename and optional logger.
 * @returns A map of exported name to source offset.
 *
 * @example
 * ```typescript
 * const offsets = extractClassOffsetsFromCss('.button-primary { color: red; }', {
 *   filename: 'styles.module.css',
 * });
 *
 * offsets.get('button-primary');
 * ```
 *
 * @group CSS Modules
 * @category Class Extraction
 */
export async function extractClassRangesFromCss(
  css: string,
  { file, options, compilerOptions = {}, logger }: ExtractClassRangesFromCssArguments,
): Promise<ExtractClassRangesFromCssReturn> {
  const filename = path.resolve(file);
  const directory = path.dirname(filename);

  return transformer(removeInlineSourceMap(css), {
    filename,
    directory,
    options,
    compilerOptions,
    logger,
  }).then(async ({ css, sourceMap }) =>
    postcss()
      .use(postcssImport({ root: directory }))
      .process(css, { from: filename, map: { inline: false, prev: sourceMap } })
      .then(({ css, map }) => {
        const sourceMap = fixSourceMap(map?.toJSON(), { directory, relativeTo: 'home' });
        const smc = sourceMap ? new SourceMapConsumer(sourceMap) : undefined;

        const lines = splitLines(css);
        const classes: Map<string, ExtractedCss> = new Map();

        postcss()
          .process(css, { from: path.basename(filename) })
          .root.walk((node) => {
            for (const { name } of walkNode(node, logger)) {
              if (!classes.has(name)) {
                let source = path.relative(directory, file);
                let start: Position = {
                  line: node.source?.start?.line ?? 1,
                  column: (node.source?.start?.column ?? 1) - 1,
                };

                const end: Position = {
                  line: node.source?.end?.line ?? 1,
                  column: (node.source?.end?.column ?? 1) - 1,
                };

                const clip = lines.slice(start.line - 1, end.line).join('\n');

                if (smc) {
                  const mp = originalPosition(smc, start, logger);
                  ({ source } = mp);
                  start = { line: mp.line, column: mp.column };
                }

                classes.set(name, {
                  css: unindent(clip),
                  source,
                  start,
                });
              }
            }
          });

        return { css, sourceMap, classes };
      }),
  );
}

function* walkNode(node: Node, logger?: Logger): Generator<ClassPosition> {
  if (node instanceof Rule) {
    yield* walkRule(node, logger);
  }
  if (node instanceof AtRule) {
    yield* walkAtRule(node, logger);
  }
}

function walkRule(rule: Rule, _logger?: Logger): ClassPosition[] {
  return selectorParser<ClassPosition[]>((selectors) => {
    const results: ClassPosition[] = [];
    selectors.walkClasses(
      (sel) =>
        void results.push({
          name: sel.value,
          offset: {
            line: sel.source?.start?.line ?? 1,
            column: (sel.source?.start?.column ?? 1) - 1,
          },
        }),
    );
    return results;
  }).transformSync(rule.selector);
}

function* walkAtRule(atRule: AtRule, logger?: Logger): Generator<ClassPosition> {
  const basePosition: Position = {
    line: 0,
    column: `@${atRule.name}`.length + (atRule.raws.afterName?.length ?? 0),
  };

  if (atRule.name === 'value' && atRule.params) {
    const importReg = /(.+)\s+from\s+.+/isv;
    const varReg = /([a-z_\-][\w\-]*)\s*:.+/isv;
    const importMatch = importReg.exec(atRule.params);
    const varMatch = varReg.exec(atRule.params);
    if (importMatch) {
      const [, importNameRawPatterns] = importMatch;
      const importPatterns = importNameRawPatterns.split(',');
      const importNamesOffsets = importPatterns.reduce<number[]>((offsets, pattern) => {
        offsets.push((offsets.at(-1) ?? 0) + pattern.length + 1);
        return offsets;
      }, []);
      for (const [i, pattern] of importPatterns.entries()) {
        const nameReg = /(.+\s+as\s+)?(.+)/iv;
        const nameMatch = nameReg.exec(pattern);
        if (nameMatch) {
          const [, rename, finalName] = nameMatch;

          yield {
            name: finalName,
            offset: positionAdd(
              getPositionOfOffset(
                atRule.params,
                (importNamesOffsets[i - 1] ?? 0) + nameMatch.index + (rename?.length ?? 0),
              ),
              basePosition,
            ),
          };
        }
      }
    } else if (varMatch) {
      const [, varName] = varMatch;

      yield { name: varName, offset: basePosition };
    } else {
      logger?.error(`Unsupported "@value" rule input: ${atRule.params}`);
    }
  } else if (atRule.name === 'keyframes') {
    yield { name: atRule.params, offset: basePosition };
  }
}
