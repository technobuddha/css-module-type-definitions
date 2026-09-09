import fs from 'node:fs/promises';
import path from 'node:path';

import { empty, zipperMerge } from '@technobuddha/library';
import postcss, { type Root } from 'postcss';
import postcssImport from 'postcss-import';

import { type Logger, type Options } from '../../common/index.ts';

import { type CssImporter } from '../css-importer.ts';
import { type CssGlobalInfo } from '../css-info.ts';
import {
  fixSourceMap,
  type RawSourceMap,
  removeInlineSourceMap,
  SourceMapConsumer,
} from '../source-map.ts';
import { Text } from '../text.ts';
import { transformer } from '../transformers/index.ts';

import { type Export } from './export.ts';
import { extractLocationsOfAnimation } from './extract-locations-of-animation.ts';
import { extractLocationsOfClassName } from './extract-locations-of-class-name.ts';
import { extractLocationsOfKeyframe } from './extract-locations-of-keyframe.ts';
import { extractInformationOfValues } from './values/index.ts';

export type ExtractorArguments = {
  readonly root: Root;
  readonly text: Text;
  readonly file: string;
  readonly directory: string;
  readonly smc: SourceMapConsumer | string;
  readonly sources: Map<string, Text>;
  readonly options: Options;
  readonly cssImporter?: CssImporter | undefined;
  readonly relativeTo: string;
  readonly importedFiles: Set<string>;
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

        const allFiles = new Set([filename, ...importedFiles].map((f) => path.resolve(f)));
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
        };

        const locationsOfClassName = await extractLocationsOfClassName(extractorArguments);
        const locationsOfAnimation = await extractLocationsOfAnimation(extractorArguments);
        const locationsOfKeyframe = await extractLocationsOfKeyframe(extractorArguments);
        const informationOfValues = await extractInformationOfValues(extractorArguments);

        const exports: Map<string, Export> = new Map();
        for (const [key, value] of locationsOfClassName) {
          exports.set(key, {
            type: 'class',
            location: value.flatMap((v) => v.location),
            snippet: value.flatMap((v) => v.snippet),
          });
        }
        for (const [key, value] of informationOfValues) {
          exports.set(key, { type: 'value', location: value.location, snippet: value.snippet });
          if (value.usages.some((u) => u.type === 'class')) {
            exports.set(value.value, {
              type: 'value-class',
              location: value.location,
              snippet: value.snippet,
            });
          }
        }
        for (const [key, value] of locationsOfKeyframe) {
          exports.set(key, {
            type: 'keyframe',
            location: value.flatMap((v) => v.location),
            snippet: value.flatMap((v) => v.snippet),
          });
        }

        return {
          css,
          sourceMap,
          info: {
            locationsOfAnimation,
            locationsOfKeyframe,
            informationOfValues,
            exports,
            importedFiles,
          },
        };
      }),
  );
}
