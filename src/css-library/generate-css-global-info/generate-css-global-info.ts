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
// import { extractLocationsOfKeyframe } from './extract-locations-of-keyframe.ts';
import { extractInformationOfValues } from './values/index.ts';

export type ExtractorArguments = {
  readonly root: Root;
  readonly text: Text;
  readonly file: string;
  readonly directory: string;
  readonly smc: SourceMapConsumer;
  readonly sources: Map<string, Text>;
  readonly options: Options;
  readonly cssImporter?: CssImporter | undefined;
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
  readonly relativeTo: string;
};

type Return = {
  readonly css: string;
  readonly sourceMap: RawSourceMap | undefined;
  readonly info: CssGlobalInfo;
};

export async function generateCssGlobalInfo(
  css: string,
  { file, options, logger, cssImporter, relativeTo }: Arguments,
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
          sources,
          logger,
          options,
          cssImporter,
          relativeTo,
          importedFiles,
          diagnostics,
        };

        const locationsOfExports = await extractLocationsOfExports(extractorArguments);
        const locationsOfAnimation = await extractLocationsOfAnimation(extractorArguments);
        // const locationsOfKeyframe = await extractLocationsOfKeyframe(extractorArguments);
        const informationOfValues = await extractInformationOfValues(extractorArguments);

        const exports: Map<string, Export[]> = new Map(locationsOfExports);
        for (const [key, value] of informationOfValues) {
          const exps: Export[] = [];
          for (let i = 0; i < value.location.length; ++i) {
            exps[i] = {
              type: 'value',
              location: value.location[i],
              snippet: value.snippet[i],
              scope: 'local',
            };
          }
          exports.set(key, exps);
          if (value.usages.some((u) => u.type === 'class' || u.type === 'id')) {
            exports.set(
              value.value,
              exps.map(({ type, ...e }) => ({ type: 'value-class', ...e })),
            );
          }
        }
        // for (const [key, value] of locationsOfKeyframe) {
        // exports.set(key, value);
        // }

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
            locationsOfKeyframe: new Map(),
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
