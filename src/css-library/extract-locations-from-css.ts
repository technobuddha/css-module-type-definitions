import fs from 'node:fs/promises';
import path from 'node:path';

import { empty, re, splitLines, unindent, zipperMerge } from '@technobuddha/library';
import postcss, { AtRule, type Node, Rule } from 'postcss';
import postcssImport from 'postcss-import';
import selectorParser from 'postcss-selector-parser';

import { type Logger, type Options } from '../common/index.ts';

import {
  type CMTDLocation,
  type CMTDPosition,
  offsetOfPosition,
  positionAdd,
  positionOfOffset,
} from './position.ts';
import {
  fixSourceMap,
  type RawSourceMap,
  removeInlineSourceMap,
  SourceMapConsumer,
} from './source-map.ts';
import { type CssImporter, transformer } from './transformers/transformer.ts';

type ClassPosition = {
  name: string;
  offset: CMTDPosition;
};

export type CssLocation = {
  snippet: string;
  location: CMTDLocation;
};

type Arguments = {
  options: Options;
  file: string;
  logger: Logger;
  cssImporter?: CssImporter;
};

type Return = {
  css: string;
  sourceMap: RawSourceMap | undefined;
  classLocations: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
};

const reEndOfSelector = /[\s,>+~.#:\{\[\)\]]/v;

export async function extractLocationsFromCss(
  css: string,
  { file, options, logger, cssImporter }: Arguments,
): Promise<Return> {
  const filename = path.resolve(file);
  const directory = path.dirname(filename);

  return transformer(removeInlineSourceMap(css), {
    filename,
    directory,
    options,
    logger,
    cssImporter,
  }).then(async ({ css, sourceMap, includedFiles }) =>
    postcss()
      .use(postcssImport({ root: directory, load: cssImporter?.css }))
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
        const sourceMap = fixSourceMap(map?.toJSON(), { directory, relativeTo: 'home', logger });
        const smc = new SourceMapConsumer({ sourceMap, source, logger });

        const lines = splitLines(css);
        const classLocations: Map<string, CssLocation[]> = new Map();

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

              classLocations.getOrInsert(name, []).push({
                snippet: unindent(lines.slice(start.line, end.line + 1).join('\n')),
                location: { source, range: { start, end } },
              });
            }
          });

        for (const [className, extracted] of Array.from(classLocations)) {
          const extractedCss: CssLocation[] = [];
          let prevSource: string | undefined;
          let prevStart: CMTDPosition | undefined;
          let skip = 0;

          for (const { snippet, location } of extracted.sort(
            (a, b) =>
              a.location.range.start.line - b.location.range.start.line ||
              a.location.range.start.column - b.location.range.start.column,
          )) {
            let { source, range } = location;
            let { start, end } = range;

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

            const op = smc.originalPosition(start);
            // eslint-disable-next-line @typescript-eslint/prefer-destructuring
            source = op.source;
            start = { line: op.line, column: op.column };

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
              start = { line: poo.line, column: poo.column + 1 };
              end = { line: start.line, column: start.column + className.length };
            } else {
              logger.warn(
                `Source file ${file}::${filename} (${source}) [${directory}] [[${sourcePath}]]`,
              );
            }
            extractedCss.push({ snippet, location: { source, range: { start, end } } });
          }
          classLocations.set(className, extractedCss);
        }

        return { css, sourceMap, classLocations, includedFiles };
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
