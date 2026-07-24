import path from 'node:path';

import {
  camelCase,
  defaultBanner,
  empty,
  isJsVariable,
  pascalCase,
  quote,
  space,
  splitLines,
  toError,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { type CompilerOptions } from 'typescript';

import { type Logger, type NormalizedOptions, removeInlineSourceMap } from '../common/index.ts';

import { BANNER_MESSAGE } from './constants.ts';
import { type CssInfo } from './css-info.ts';
import { dashes } from './dashes.ts';
import { type CssLocation, extractClassRangesFromCss } from './extract-class-ranges-from-css.ts';
import { type Position, type Range } from './position.ts';
import { SourceMapGenerator } from './source-map.ts';

export type GenerateTypesFromCssOptions = {
  options: NormalizedOptions;
  logger: Logger;
  compilerOptions?: CompilerOptions;
};

export async function generateTypesFromCss(
  css: string,
  filepath: string,
  { options, logger }: GenerateTypesFromCssOptions,
): Promise<CssInfo> {
  const file = path.resolve(filepath);

  return extractClassRangesFromCss(css, { file, options, logger }).then(
    async ({ css, classLocation: classLocations, includedFiles }) => {
      let classScope: Record<string, string>;
      return postcss()
        .use(
          postcssModules({
            ...options.css.modules,
            getJSON: (_cssFilename, json, _outputFilename) => {
              classScope = json;
            },
          }),
        )
        .process(removeInlineSourceMap(css), {
          from: file,
          map: { inline: false },
        })
        .then(() => {
          const classLocal: Map<string, Set<string>> = new Map();
          for (const className of classLocations.keys()) {
            if (!classLocal.has(className)) {
              switch (options.css.modules.localsConvention) {
                case 'camelCase': {
                  classLocal.set(className, new Set([className, camelCase(className)]));
                  break;
                }
                case 'camelCaseOnly': {
                  classLocal.set(className, new Set([camelCase(className)]));
                  break;
                }
                case 'dashes': {
                  classLocal.set(className, new Set([className, dashes(className)]));
                  break;
                }
                case 'dashesOnly': {
                  classLocal.set(className, new Set([dashes(className)]));
                  break;
                }
                case 'all': {
                  classLocal.set(
                    className,
                    new Set([className, camelCase(className), dashes(className)]),
                  );
                  break;
                }
                case 'none':
                case undefined:
                default: {
                  classLocal.set(className, new Set([className]));
                  break;
                }
              }
            }
          }

          const localClass: Map<string, Set<string>> = new Map();
          for (const [className, set] of classLocal) {
            for (const alias of set) {
              localClass.set(alias, (localClass.get(alias) ?? new Set()).add(className));
            }
          }

          const extractedCss: Map<string, CssLocation[]> = new Map();
          for (const [className, set] of classLocal) {
            for (const alias of set) {
              extractedCss.set(alias, classLocations.get(className) ?? []);
            }
          }

          const parsed = path.parse(file);
          let variable = camelCase(parsed.name.replace(/\.module$/v, empty));
          let classname = pascalCase(variable);
          if (!isJsVariable(variable)) {
            variable = camelCase(parsed.ext.replace(/^\./v, empty));
            classname = pascalCase(variable);
          }

          const dts: string[] = [
            '// cspell:disable',
            '/* eslint eslint-comments/no-unlimited-disable: "off" */',
            '/* eslint-disable */',
            '{',
            ...defaultBanner(BANNER_MESSAGE).map((line) => `${space.repeat(2)}// ${line}`),
            '}',
            ...(options.css.dtsHeader ? splitLines(options.css.dtsHeader) : []),
            empty,
            '// prettier-ignore',
            `${space.repeat(0)}type ${classname} = {`,
          ];

          const { dir, name, ext } = path.parse(file);
          const dtsFile = `${name}.d${ext}.ts`;
          const dtsRange: Map<string, Range> = new Map();
          const mapFile = `${dtsFile}.map`;

          const smg = new SourceMapGenerator({ file: dtsFile, logger });

          const classEntries = Array.from(
            extractedCss,
            ([className, extracted]) => [className, extracted[0]] as const,
          ).sort(
            ([, a], [, b]) =>
              a.location.range.start.line - b.location.range.start.line ||
              a.location.range.start.column - b.location.range.start.column,
          );

          for (const [className, extracted] of classEntries) {
            const {
              location: {
                source,
                range: {
                  start: { line, column },
                },
              },
            } = extracted;

            const generated: Position = {
              line: dts.length,
              column: 11, // length of {space.repeat(2)}readonly{space}{quote},
            };

            smg.addMapping({
              source,
              generated,
              original: { line, column },
            });

            dts.push(
              `${space.repeat(2)}readonly${space}${quote(className)}:${space}${quote(classScope[className])};`,
            );

            dtsRange.set(className, {
              start: { line: generated.line, column: generated.column + 1 },
              end: { line: generated.line, column: generated.column + className.length + 1 },
            });
          }

          dts.push(
            `${space.repeat(0)}};`,
            empty,
            `${space.repeat(0)}declare const ${variable}: ${classname};`,
            empty,
            `${space.repeat(0)}export default ${variable};`,
            empty,
            `//# sourceMappingURL=${path.basename(mapFile)}`,
            empty,
            ...splitLines(options.css.dtsFooter ?? empty),
            empty,
          );

          return {
            files: {
              [path.resolve(dir, dtsFile)]: dts.join('\n'),
              [path.resolve(dir, mapFile)]: JSON.stringify(smg.sourceMap()),
            },
            dtsFile,
            mapFile,
            classLocations,
            includedFiles,
            classLocal,
            localClass,
            dtsRange,
          };
        })
        .catch((error) => {
          logger.error(toError(error), ' <== From gtcss');
          throw toError(error);
        });
    },
  );
}
