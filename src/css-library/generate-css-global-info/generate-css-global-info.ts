import fs from 'node:fs/promises';
import path from 'node:path';

import { camelCase, empty, zipperMerge } from '@technobuddha/library';
import postcss, { type Root } from 'postcss';
import postcssImport from 'postcss-import';

import { type Logger, type Options } from '../../common/index.ts';

import {
  type CssGlobalInfo,
  type CssImporter,
  dashes,
  type Diagnostic,
  type Export,
  fixSourceMap,
  type RawSourceMap,
  removeInlineSourceMap,
  SourceMapConsumer,
  Text,
} from '../helpers/index.ts';
import { transformer } from '../transformers/index.ts';

import { extractLocationsOfAnimation } from './extract-locations-of-animation.ts';
import { extractLocationsOfExports } from './extract-locations-of-exports.ts';
import { extractInformationOfValues } from './values/index.ts';

export type ExtractorArguments = {
  readonly root: Root;
  readonly text: Text;
  readonly file: string;
  readonly directory: string;
  readonly smc: SourceMapConsumer;
  readonly options: Options;
  readonly cssImporter?: CssImporter | undefined;
  readonly loadSource: (file: string) => Promise<Text>;
  readonly relativeTo: string;
  readonly importedFiles: Set<string>;
  readonly diagnostics: Diagnostic[];
  readonly logger: Logger;
};

type Arguments = {
  readonly options: Options;
  readonly file: string;
  readonly logger: Logger;
  readonly cssImporter?: CssImporter | undefined;
  readonly loadSource?: ((file: string) => Promise<Text>) | undefined;
  readonly relativeTo: string;
};

type Return = {
  readonly css: string;
  readonly sourceMap: RawSourceMap | undefined;
  readonly info: CssGlobalInfo;
};

export async function generateCssGlobalInfo(
  css: string,
  { file, options, logger, cssImporter, relativeTo, loadSource }: Arguments,
): Promise<Return> {
  const filename = path.resolve(file);
  const directory = path.dirname(filename);

  return transformer(removeInlineSourceMap(css), {
    filename,
    directory,
    options,
    logger,
    cssImporter,
  }).then(async ({ css, sourceMap, importedFiles }) =>
    postcss()
      .use(postcssImport({ root: directory, ...(cssImporter?.css && { load: cssImporter.css }) }))
      .process(css, {
        from: filename,
        map: { inline: false, ...(sourceMap && { prev: sourceMap }) },
      })
      .then(async ({ css, map, messages }) => {
        for (const message of messages) {
          if (message.type === 'dependency' && typeof message.file === 'string') {
            importedFiles.add(message.file);
          }
        }

        const allFiles = new Set(
          [filename, ...importedFiles].map((f) => path.resolve(directory, f)),
        );
        const sources = new Map(
          zipperMerge(
            allFiles,
            await Promise.all(
              allFiles.values().map(async (file) => fs.readFile(file, 'utf-8').catch(() => empty)),
            ).then((texts) => texts.map((text) => new Text(text))),
          ),
        );

        const sourceFile = path.relative(directory, file);
        const sourceMap = fixSourceMap(map?.toJSON(), directory, relativeTo);
        const smc = new SourceMapConsumer({ sourceMap, source: sourceFile, logger });
        const text = new Text(css);
        const diagnostics: Diagnostic[] = [];

        const { root } = postcss().process(css, { from: path.basename(filename) });

        const extractorArguments: ExtractorArguments = {
          root,
          text,
          file,
          directory,
          smc,
          logger,
          loadSource:
            loadSource ??
            (async (filename: string): Promise<Text> => {
              let text = sources.get(filename);
              if (!text) {
                text = new Text(await fs.readFile(filename, 'utf-8'));
                sources.set(filename, text);
              }
              return text;
            }),
          options,
          cssImporter,
          relativeTo,
          importedFiles,
          diagnostics,
        };

        const locationsOfExports = await extractLocationsOfExports(extractorArguments);
        const locationsOfAnimation = await extractLocationsOfAnimation(extractorArguments);
        const informationOfValues = await extractInformationOfValues(extractorArguments);

        const exports: Map<string, Export[]> = new Map(locationsOfExports);
        for (const [key, info] of informationOfValues) {
          for (const { location, snippet } of info.locationAndSnippet) {
            exports
              .getOrInsertComputed(key, () => [])
              .push({
                type: 'value',
                location,
                snippet,
                scope: 'local',
              });
          }
          if (info.usages.some((u) => u.type === 'class' || u.type === 'id')) {
            exports
              .getOrInsertComputed(info.value, () => [])
              .push({
                type: 'variable',
                location: info.definition,
                snippet: info.locationAndSnippet[0].snippet,
                scope: 'local',
              });
          }
        }

        const localNamesOfExport: Map<string, Set<string>> = new Map();
        for (const exportName of exports.keys()) {
          if (!localNamesOfExport.has(exportName)) {
            switch (options.css.modules.localsConvention) {
              case 'camelCase': {
                localNamesOfExport.set(exportName, new Set([exportName, camelCase(exportName)]));
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

        return {
          css,
          sourceMap,
          info: {
            locationsOfAnimation,
            informationOfValues,
            localNamesOfExport,
            exportNamesOfLocalName,
            exports,
            importedFiles,
            diagnostics,
          },
        };
      }),
  );
}
