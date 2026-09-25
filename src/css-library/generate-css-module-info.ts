import path from 'node:path';

import { fileExists, omitProperties, toError } from '@technobuddha/library';
import genericNames from 'generic-names';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';

import { type Logger, type Options } from '../common/index.ts';

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
  type Text,
} from './helpers/index.ts';

type Arguments = {
  readonly options: Options;
  readonly logger: Logger;
  readonly relativeTo: string;
  readonly root: string;
  readonly cssImporter?: CssImporter;
  readonly loadSource?: ((file: string) => Promise<Text>) | undefined;
};

export async function generateCssModuleInfo(
  css: string,
  filepath: string,
  { options, logger, cssImporter, relativeTo, root, loadSource }: Arguments,
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

  return generateCssGlobalInfo(css, {
    file,
    options,
    logger,
    cssImporter,
    relativeTo,
    loadSource,
  }).then(
    async ({
      css,
      info: {
        filename,
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
          const exportInfo = exports.get(exportName);
          if (exportInfo) {
            if (exportInfo.length > 0) {
              locationsOfLocalNames.set(localName, exportInfo.at(0)!.location);
            }
          }
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

              let eligible = exports
                .entries()
                .filter(([, exports]) => exports && exports.length > 0);

              if (!options.css.modules.exportGlobals) {
                eligible = eligible.filter(([, exports]) =>
                  exports.some((e) => e.scope === 'local'),
                );
              }

              if (options.css.modules.scopeBehaviour === 'global') {
                eligible = eligible.filter(([, exports]) =>
                  exports.some((e) => e.type !== 'keyframes'),
                );
              }

              const localLocations = Array.from(
                eligible.flatMap(([exportName, exports]) =>
                  (localNamesOfExport.get(exportName)?.values() ?? []).map(
                    (localName) => [localName, exports.at(0)!.location] as const,
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
            new Diagnostic(new Range(0, 0, 0, 0), toError(error).message, DiagnosticSeverity.Error),
          );
        });

      return {
        dtsContents: dts.finalize(),
        dtsFilename: path.resolve(dir, dtsFilename),
        hasDts,
        filename,
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
  );
}
