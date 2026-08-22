import path from 'node:path';

import {
  camelCase,
  empty,
  encodeBase64,
  fileExists,
  quote,
  space,
  toError,
} from '@technobuddha/library';
import genericNames from 'generic-names';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';

import { type Logger, type Options } from '../common/index.ts';

import { type CssImporter } from './css-importer/index.ts';
import { type CssModuleInfo } from './css-info.ts';
import { dashes } from './dashes.ts';
import { dtsBottom } from './dts-bottom.ts';
import { dtsInfo } from './dts-info.ts';
import { dtsMiddle } from './dts-middle.ts';
import { dtsTop } from './dts-top.ts';
import { type CssLocation, extractLocations } from './extract-locations.ts';
import { type CMTDPosition, type CMTDRange } from './position.ts';
import { removeInlineSourceMap, SourceMapGenerator } from './source-map.ts';

type Arguments = {
  readonly options: Options;
  readonly logger: Logger;
  readonly relativeTo: string;
  readonly root: string;
  readonly cssImporter?: CssImporter;
};

export async function generateCssModuleInfo(
  css: string,
  filepath: string,
  { options, logger, cssImporter, relativeTo, root }: Arguments,
): Promise<CssModuleInfo> {
  const file = path.resolve(filepath);

  // postcss-modules uses process.cwd() as the context for generating scoped names.
  // However, our cwd will not necessarily be the same as the root of the project,
  // so we need to set the context explicitly.
  let { generateScopedName } = options.css.modules;
  if (generateScopedName) {
    if (typeof generateScopedName !== 'function') {
      generateScopedName = genericNames(generateScopedName, {
        context: root,
        hashPrefix: options.css.modules.hashPrefix,
      });
    }
  }

  return extractLocations(css, { file, options, logger, cssImporter, relativeTo })
    .then(async ({ css, info: { classLocations: locationsOfClass, includedFiles } }) => {
      let classScope: Record<string, string>;
      return postcss()
        .use(
          postcssModules({
            ...options.css.modules,
            generateScopedName,
            getJSON: (_cssFilename, json, _outputFilename) => {
              classScope = json;
            },
          }),
        )
        .process(removeInlineSourceMap(css), {
          from: file,
          map: { inline: false },
        })
        .then(async () => {
          const classLocal: Map<string, Set<string>> = new Map();
          for (const className of locationsOfClass.keys()) {
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
              extractedCss.set(alias, locationsOfClass.get(className) ?? []);
            }
          }

          const info = dtsInfo(file, options);
          const dts = dtsTop(info);

          const { dir, name, ext } = path.parse(file);
          const dtsFilename = `${name}.d${ext}.ts`;

          const hasDts = await fileExists(path.join(dir, dtsFilename));

          const dtsRange: Map<string, CMTDRange> = new Map();

          const smg = new SourceMapGenerator({ file: dtsFilename, logger });

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

            const generated: CMTDPosition = {
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
            ...dtsMiddle(info),
            empty,
            `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodeBase64(JSON.stringify(smg.sourceMap()), 'utf-8')}`,
            ...dtsBottom(info),
          );

          return {
            dtsContents: dts.join('\n'),
            dtsFilename: path.resolve(dir, dtsFilename),
            hasDts,
            locationsOfClass,
            includedFiles,
            classLocal,
            localClass,
            dtsRange,
            classScope,
          };
        })
        .catch((error) => {
          logger.error(
            `${toError(error).message}: Failed to generate type definitions for ${file}`,
          );
          throw toError(error);
        });
    })
    .catch((error) => {
      logger.error(`ELFC: ${Error.isError(error) ? error : String(error)}`);
      throw error;
    });
}
