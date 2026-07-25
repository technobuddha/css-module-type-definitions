import fs from 'node:fs/promises';
import path from 'node:path';

import { empty, re, splitLines, unindent, zipperMerge } from '@technobuddha/library';
import postcss, { AtRule, type Node, Rule } from 'postcss';
import postcssImport from 'postcss-import';
import selectorParser from 'postcss-selector-parser';

import { type Logger, type NormalizedOptions, removeInlineSourceMap } from '../common/index.ts';

import {
  type CMTDLocation,
  type CMTDPosition,
  offsetOfPosition,
  positionAdd,
  positionOfOffset,
} from './position.ts';
import { fixSourceMap, type RawSourceMap, SourceMapConsumer } from './source-map.ts';
import { transformer } from './transformers/transformer.ts';

type ClassPosition = {
  name: string;
  offset: CMTDPosition;
};

type Arguments = {
  options: NormalizedOptions;
  file: string;
  logger: Logger;
};

export type CssLocation = {
  snippet: string;
  location: CMTDLocation;
};

type Return = {
  css: string;
  sourceMap: RawSourceMap | undefined;
  classLocation: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
};

const reEndOfSelector = /[\s,>+~.#:\{\[\)\]]/v;

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
  { file, options, logger }: Arguments,
): Promise<Return> {
  const filename = path.resolve(file);
  const directory = path.dirname(filename);

  return transformer(removeInlineSourceMap(css), {
    filename,
    directory,
    options,
    logger,
  }).then(async ({ css, sourceMap, includedFiles }) =>
    postcss()
      .use(postcssImport({ root: directory }))
      .process(css, { from: filename, map: { inline: false, prev: sourceMap } })
      .then(async ({ css, map, messages }) => {
        for (const message of messages) {
          if (message.type === 'dependency' && typeof message.file === 'string') {
            includedFiles.add(message.file);
          }
        }

        const allFiles = new Set([filename, ...includedFiles].map((f) => path.resolve(f)));
        const sources = new Map(
          zipperMerge(
            allFiles,
            await Promise.all(
              allFiles.values().map(async (file) => fs.readFile(file, 'utf-8').catch(() => empty)),
            ),
          ),
        );

        const source = path.relative(directory, file);
        const sourceMap = fixSourceMap(map?.toJSON(), { directory, relativeTo: 'home' });
        const smc = new SourceMapConsumer({ sourceMap, source, logger });

        const lines = splitLines(css);
        const classLocation: Map<string, CssLocation[]> = new Map();

        postcss()
          .process(css, { from: path.basename(filename) })
          .root.walk((node) => {
            for (const { name } of walkNode(node, logger)) {
              // postcss's Position is 1-based, but we use 0-based

              const start: CMTDPosition = {
                line: (node.source?.start?.line ?? 1) - 1,
                column: (node.source?.start?.column ?? 1) - 1,
              };

              const end: CMTDPosition = {
                line: (node.source?.end?.line ?? 1) - 1,
                column: (node.source?.end?.column ?? 1) - 1,
              };

              classLocation.set(name, [
                ...(classLocation.get(name) ?? []),
                {
                  snippet: unindent(lines.slice(start.line, end.line + 1).join('\n')),
                  location: { source, range: { start, end } },
                },
              ]);
            }
          });

        for (const [className, extracted] of Array.from(classLocation)) {
          const extractedCss: CssLocation[] = [];
          let prevSource: string | undefined;
          let prevStart: CMTDPosition | undefined;
          let skip = 0;

          for (let {
            snippet,
            location: {
              source,
              range: { start, end },
            },
          } of extracted.sort(
            (a, b) =>
              a.location.range.start.line - b.location.range.start.line ||
              a.location.range.start.column - b.location.range.start.column,
          )) {
            if (
              prevSource === source &&
              prevStart?.line === start.line &&
              prevStart?.column === start.column
            ) {
              skip++;
            } else {
              skip = 0;
              prevSource = source;
              prevStart = start;
            }

            const {
              source: opSource,
              line: opLine,
              column: opColumn,
            } = smc.originalPosition(start);
            source = opSource;
            start = { line: opLine, column: opColumn };

            const sourcePath = path.resolve(directory, source);
            const content = sources.get(sourcePath)!;
            if (content) {
              let offset = offsetOfPosition(content, start);

              let nameOffset = 0;
              for (let i = 0; i <= skip; ++i) {
                const pos = content
                  .slice(offset + nameOffset)
                  .search(re`\.${className}${reEndOfSelector}`);
                if (pos >= 0) {
                  offset += pos + nameOffset;
                  nameOffset = className.length + 2;
                } else {
                  break;
                }
              }

              const poo = positionOfOffset(content, offset);
              start = { line: poo.line, column: poo.column };
              end = { line: start.line, column: start.column + className.length + 1 };
            } else {
              logger.warn(`Source file ${file} (${source})`);
            }
            extractedCss.push({ snippet, location: { source, range: { start, end } } });
          }
          classLocation.set(className, extractedCss);
        }

        return { css, sourceMap, classLocation, includedFiles };
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
  const basePosition: CMTDPosition = {
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
              positionOfOffset(
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
