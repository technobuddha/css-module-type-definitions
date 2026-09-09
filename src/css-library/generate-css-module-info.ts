import path from 'node:path';

import {
  camelCase,
  empty,
  encodeBase64,
  fileExists,
  omitProperties,
  quote,
  space,
} from '@technobuddha/library';
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
import { generateCssGlobalInfo } from './generate-css-global-info/index.ts';
import { type Location, Position, Range } from './position.ts';
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

  return generateCssGlobalInfo(css, { file, options, logger, cssImporter, relativeTo })
    .then(
      async ({
        css,
        info: { locationsOfAnimation, informationOfValues, exports, importedFiles },
      }) => {
        const scopeNameOfExportName: Map<string, string> = new Map();
        return postcss()
          .use(
            postcssModules({
              ...omitProperties(options.css.modules, 'generateScopedName'),
              ...(generateScopedName && { generateScopedName }),
              getJSON: (_cssFilename, json, _outputFilename) => {
                for (const [exportName, scopeName] of Object.entries(json)) {
                  scopeNameOfExportName.set(exportName, scopeName);
                }
              },
            }),
          )
          .process(removeInlineSourceMap(css), {
            from: file,
            map: { inline: false },
          })
          .then(async () => {
            const localNamesOfExport: Map<string, Set<string>> = new Map();
            for (const exportName of exports.keys()) {
              if (!localNamesOfExport.has(exportName)) {
                switch (options.css.modules.localsConvention) {
                  case 'camelCase': {
                    localNamesOfExport.set(
                      exportName,
                      new Set([exportName, camelCase(exportName)]),
                    );
                    break;
                  }
                  case 'camelCaseOnly': {
                    localNamesOfExport.set(exportName, new Set([camelCase(exportName)]));
                    break;
                  }
                  case 'dashes': {
                    localNamesOfExport.set(exportName, new Set([exportName, dashes(exportName)]));
                    break;
                  }
                  case 'dashesOnly': {
                    localNamesOfExport.set(exportName, new Set([dashes(exportName)]));
                    break;
                  }
                  case 'all': {
                    localNamesOfExport.set(
                      exportName,
                      new Set([exportName, camelCase(exportName), dashes(exportName)]),
                    );
                    break;
                  }
                  case 'none':
                  case undefined:
                  default: {
                    localNamesOfExport.set(exportName, new Set([exportName]));
                    break;
                  }
                }
              }
            }

            const exportNamesOfLocalName: Map<string, Set<string>> = new Map();
            for (const [exportName, set] of localNamesOfExport) {
              for (const alias of set) {
                exportNamesOfLocalName.getOrInsertComputed(alias, () => new Set()).add(exportName);
              }
            }

            const extractedCss: Map<string, readonly Location[]> = new Map();
            for (const [exportName, set] of localNamesOfExport) {
              for (const alias of set) {
                extractedCss.set(alias, exports.get(exportName)?.location ?? []);
              }
            }

            const info = dtsInfo(file, options);
            const dts = dtsTop(info);

            const { dir, name, ext } = path.parse(file);
            const dtsFilename = `${name}.d${ext}.ts`;

            const hasDts = await fileExists(path.join(dir, dtsFilename));

            const dtsRange: Map<string, Range> = new Map();

            const smg = new SourceMapGenerator({ file: dtsFilename, logger });

            const classEntries = Array.from(
              extractedCss,
              ([className, extracted]) => [className, extracted[0]] as const,
            ).sort(
              ([, a], [, b]) =>
                a.range.start.line - b.range.start.line ||
                a.range.start.column - b.range.start.column,
            );
            for (const [className, extracted] of classEntries) {
              const {
                source,
                range: {
                  start: { line, column },
                },
              } = extracted;

              // 11 = length of {space.repeat(2)}readonly{space}{quote},
              const generated = new Position(dts.length, 11);

              smg.addMapping({
                source,
                generated,
                original: new Position(line, column),
              });

              dts.push(
                `${space.repeat(2)}readonly${space}${quote(className)}:${space}${quote(scopeNameOfExportName.get(className)!)};`,
              );

              dtsRange.set(
                className,
                new Range(
                  new Position(generated.line, generated.column + 1),
                  new Position(generated.line, generated.column + className.length + 1),
                ),
              );
            }

            dts.push(
              ...dtsMiddle(info),
              // empty,
              // `// scoped= ${JSON.stringify(Object.fromEntries(scopeNameOfExportName))}`,
              empty,
              `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodeBase64(JSON.stringify(smg.sourceMap()), 'utf-8')}`,
              ...dtsBottom(info),
            );

            return {
              dtsContents: dts.join('\n'),
              dtsFilename: path.resolve(dir, dtsFilename),
              hasDts,
              locationsOfAnimation,
              informationOfValues,
              exports,
              importedFiles,
              localNamesOfExport,
              exportNamesOfLocalName,
              dtsRange,
              scopeNameOfExportName,
            };
          })
          .catch((error) => {
            logger.error(fileOperation(file, 'error', error), '<== 201');
            throw error;
          });
      },
    )
    .catch((error) => {
      logger.error(fileOperation(filepath, 'error', error), '<== 207');
      throw error;
    });
}
