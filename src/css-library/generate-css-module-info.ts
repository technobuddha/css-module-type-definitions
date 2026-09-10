import path from 'node:path';

import {
  empty,
  encodeBase64,
  fileExists,
  omitProperties,
  quote,
  space,
  toError,
} from '@technobuddha/library';
import genericNames from 'generic-names';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';

import { fileOperation, type Logger, type Options } from '../common/index.ts';

import { type CssImporter } from './css-importer.ts';
import { type CssModuleInfo } from './css-info.ts';
import { dtsBottom } from './dts-bottom.ts';
import { dtsInfo } from './dts-info.ts';
import { dtsMiddle } from './dts-middle.ts';
import { dtsTop } from './dts-top.ts';
import {
  Diagnostic,
  DiagnosticSeverity,
  generateCssGlobalInfo,
} from './generate-css-global-info/index.ts';
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

  const { dir, name, ext } = path.parse(file);
  const dtsFilename = `${name}.d${ext}.ts`;
  const hasDts = await fileExists(path.join(dir, dtsFilename));

  return generateCssGlobalInfo(css, { file, options, logger, cssImporter, relativeTo })
    .then(
      async ({
        css,
        info: {
          locationsOfAnimation,
          informationOfValues,
          exports,
          importedFiles,
          diagnostics,
          localNamesOfExport,
          exportNamesOfLocalName,
        },
      }) => {
        const locationsOfLocalNames: Map<string, Location> = new Map();
        for (const [exportName, localNames] of localNamesOfExport) {
          for (const localName of localNames) {
            locationsOfLocalNames.set(localName, exports.get(exportName)!.location[0]);
          }
        }

        const info = dtsInfo(file, options);
        const dts = dtsTop(info);
        const smg = new SourceMapGenerator({ file: dtsFilename, logger });
        let scopeNameOfExportName: Map<string, string> = new Map();

        await postcss()
          .use(
            postcssModules({
              ...omitProperties(options.css.modules, 'generateScopedName'),
              ...(generateScopedName && { generateScopedName }),
              getJSON: (_cssFilename, json, _outputFilename) => {
                scopeNameOfExportName = new Map(Object.entries(json));

                const localLocations = Array.from(
                  localNamesOfExport
                    .entries()
                    .flatMap(([exportName, localNames]) =>
                      localNames
                        .values()
                        .map(
                          (localName) => [localName, exports.get(exportName)!.location[0]] as const,
                        ),
                    ),
                ).sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

                for (const [localName, location] of localLocations) {
                  smg.addMapping({
                    source: location.source,
                    // 11 = length of {space.repeat(2)}readonly{space}{quote},
                    generated: new Position(dts.length, 11),
                    original: location.range.start,
                  });

                  dts.push(
                    `${space.repeat(2)}readonly${space}${quote(localName)}:${space}${quote(scopeNameOfExportName.get(localName)!)};`,
                  );
                }
              },
            }),
          )
          .process(removeInlineSourceMap(css), {
            from: file,
            map: { inline: false },
          })
          .then(async () => {})
          .catch((error) => {
            diagnostics.push(
              new Diagnostic(
                new Range(0, 0, 0, 0),
                toError(error).message,
                DiagnosticSeverity.Error,
              ),
            );
          });

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
          locationsOfAnimation,
          informationOfValues,
          exports,
          diagnostics,
          importedFiles,
          localNamesOfExport,
          exportNamesOfLocalName,
          scopeNameOfExportName,
        };
      },
    )
    .catch((error) => {
      logger.error(fileOperation(filepath, 'error', error), '<== generate-css-module-info: 222');
      throw error;
    });
}
