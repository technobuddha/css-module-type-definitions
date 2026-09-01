import path from 'node:path';

import { camelCase, empty, encodeBase64, fileExists, quote, space } from '@technobuddha/library';
import genericNames from 'generic-names';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';

import { fileOperation, type Logger, type Options } from '../common/index.ts';

import { type CssImporter } from './css-importer.ts';
import { type CssModuleInfo } from './css-info.ts';
import { dashes } from './dashes.ts';
import { dtsBottom } from './dts-bottom.ts';
import { dtsInfo } from './dts-info.ts';
import { dtsMiddle } from './dts-middle.ts';
import { dtsTop } from './dts-top.ts';
import { type CssLocation, extractLocations } from './extract-locations.ts';
import { Pos, PosRange } from './position.ts';
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
    .then(async ({ css, info: { locationsOfClassName, importedFiles } }) => {
      const scopeNameOfClassName: Map<string, string> = new Map();
      return postcss()
        .use(
          postcssModules({
            ...options.css.modules,
            generateScopedName,
            getJSON: (_cssFilename, json, _outputFilename) => {
              for (const [className, scopeName] of Object.entries(json)) {
                scopeNameOfClassName.set(className, scopeName);
              }
            },
          }),
        )
        .process(removeInlineSourceMap(css), {
          from: file,
          map: { inline: false },
        })
        .then(async () => {
          const localNamesOfClassName: Map<string, Set<string>> = new Map();
          for (const className of locationsOfClassName.keys()) {
            if (!localNamesOfClassName.has(className)) {
              switch (options.css.modules.localsConvention) {
                case 'camelCase': {
                  localNamesOfClassName.set(className, new Set([className, camelCase(className)]));
                  break;
                }
                case 'camelCaseOnly': {
                  localNamesOfClassName.set(className, new Set([camelCase(className)]));
                  break;
                }
                case 'dashes': {
                  localNamesOfClassName.set(className, new Set([className, dashes(className)]));
                  break;
                }
                case 'dashesOnly': {
                  localNamesOfClassName.set(className, new Set([dashes(className)]));
                  break;
                }
                case 'all': {
                  localNamesOfClassName.set(
                    className,
                    new Set([className, camelCase(className), dashes(className)]),
                  );
                  break;
                }
                case 'none':
                case undefined:
                default: {
                  localNamesOfClassName.set(className, new Set([className]));
                  break;
                }
              }
            }
          }

          const classNamesOfLocalName: Map<string, Set<string>> = new Map();
          for (const [className, set] of localNamesOfClassName) {
            for (const alias of set) {
              classNamesOfLocalName.getOrInsertComputed(alias, () => new Set()).add(className);
            }
          }

          const extractedCss: Map<string, CssLocation[]> = new Map();
          for (const [className, set] of localNamesOfClassName) {
            for (const alias of set) {
              extractedCss.set(alias, locationsOfClassName.get(className) ?? []);
            }
          }

          const info = dtsInfo(file, options);
          const dts = dtsTop(info);

          const { dir, name, ext } = path.parse(file);
          const dtsFilename = `${name}.d${ext}.ts`;

          const hasDts = await fileExists(path.join(dir, dtsFilename));

          const dtsRange: Map<string, PosRange> = new Map();

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

            // 11 = length of {space.repeat(2)}readonly{space}{quote},
            const generated = new Pos(dts.length, 11);

            smg.addMapping({
              source,
              generated,
              original: new Pos(line, column - 1),
            });

            dts.push(
              `${space.repeat(2)}readonly${space}${quote(className)}:${space}${quote(scopeNameOfClassName.get(className)!)};`,
            );

            dtsRange.set(
              className,
              new PosRange(
                new Pos(generated.line, generated.column + 1),
                new Pos(generated.line, generated.column + className.length + 1),
              ),
            );
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
            locationsOfClassName,
            importedFiles,
            localNamesOfClassName,
            classNamesOfLocalName,
            dtsRange,
            scopeNameOfClassName,
          };
        })
        .catch((error) => {
          logger.error(fileOperation(file, 'error', error));
          throw error;
        });
    })
    .catch((error) => {
      logger.error(fileOperation(filepath, 'error', error));
      throw error;
    });
}
