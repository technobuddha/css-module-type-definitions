import path from 'node:path';

import { fileExists, omitProperties, toError } from '@technobuddha/library';
import genericNames from 'generic-names';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';

import { fileOperation, type Logger, type Options } from '../common/index.ts';

import { generateCssGlobalInfo } from './generate-css-global-info/index.ts';
import {
  type CssImporter,
  type CssModuleInfo,
  Diagnostic,
  DiagnosticSeverity,
  DtsBuilder,
  type Location,
  Range,
  removeInlineSourceMap,
} from './helpers/index.ts';

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

        const dts = new DtsBuilder(file, dtsFilename, options, logger);
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
                  dts.add(
                    location.source,
                    location.range.start,
                    localName,
                    scopeNameOfExportName.get(localName)!,
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

        return {
          dtsContents: dts.finalize(),
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
