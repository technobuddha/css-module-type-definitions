import path from 'node:path';

import {
  camelCase,
  defaultBanner,
  empty,
  isValidJsVariable,
  pascalCase,
  quote,
  space,
  splitLines,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssModules from 'postcss-modules';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger, type Options } from '../common/index.ts';

import { BANNER_MESSAGE } from './constants.ts';
import { dashes } from './dashes.ts';
import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { type Offset } from './offset.ts';
import { transformer } from './transformers/transformer.ts';

type GenerateTypesFromCssReturn = {
  files: Record<string, string>;
  offsets: Map<string, Offset>;
};

export type GenerateTypesFromCssOptions = {
  options: Options;
  logger: Logger;
  compilerOptions?: CompilerOptions;
};

export async function generateTypesFromCss(
  css: string,
  filename: string,
  { options, logger, compilerOptions = {} }: GenerateTypesFromCssOptions,
): Promise<GenerateTypesFromCssReturn> {
  const directory = path.dirname(filename);

  const { cssModules } = options;

  logger.log(`Generating types for ${filename} in ${directory}`);

  return transformer(css, {
    filename,
    directory,
    options,
    compilerOptions,
    logger,
  })
    .then(async ({ css, sourceMap }) =>
      postcss([postcssImport()])
        .process(css, { from: filename, map: { inline: false, prev: sourceMap } })
        .then(async ({ css, map }) => {
          const sourceMap = map?.toJSON();

          if (sourceMap) {
            for (let i = 0; i < sourceMap.sources.length; i++) {
              sourceMap.sources[i] = path.resolve(sourceMap.sources[i]);
            }
          }

          const classOffsets = extractClassOffsetsFromCss(css, { filename, logger });
          let classScope: Record<string, string>;

          return postcss([
            postcssModules({
              ...cssModules,
              getJSON: (cssFilename, json, outputFilename) => {
                classScope = json;
                logger.log(`Extracted class names from ${cssFilename}: ${outputFilename}`);
                logger.log(JSON.stringify(json));
                return cssModules.getJSON?.(cssFilename, json, outputFilename ?? empty);
              },
            }),
          ])
            .process(css, {
              from: path.basename(filename),
              map: { inline: false, prev: sourceMap },
            })
            .then(({ map }) => {
              for (const className of Object.keys(classScope)) {
                let offset = classOffsets.get(className);

                if (
                  !offset &&
                  (cssModules.localsConvention === 'camelCase' ||
                    cssModules.localsConvention === 'camelCaseOnly')
                ) {
                  for (const [n, o] of classOffsets.entries()) {
                    if (camelCase(n) === className) {
                      offset = o;
                      break;
                    }
                  }
                }
                if (
                  !offset &&
                  (cssModules.localsConvention === 'dashes' ||
                    cssModules.localsConvention === 'dashesOnly')
                ) {
                  for (const [n, o] of classOffsets.entries()) {
                    if (dashes(n) === className) {
                      offset = o;
                      break;
                    }
                  }
                }

                if (offset) {
                  classOffsets.set(className, offset);
                } else {
                  logger.error(`Could not find offset ${className} in ${filename}`);
                }
              }

              const sourceMap = map?.toJSON();
              const parsed = path.parse(filename);

              let variable = camelCase(parsed.name.replace(/\.module$/v, empty));
              let classname = pascalCase(variable);
              if (!isValidJsVariable(variable)) {
                variable = camelCase(parsed.ext.replace(/^\./v, empty));
                classname = pascalCase(variable);
              }

              const dts: string[] = [
                ...(cssModules.dtsBanner ?
                  defaultBanner(BANNER_MESSAGE).map((line) => `// ${line}`)
                : []),
                ...splitLines(cssModules.dtsHeader ?? empty),
                empty,
                `${space.repeat(0)}type ${classname} = {`,
              ];

              const { dir, name, ext, base } = path.parse(filename);
              const dtsFile = `${name}.d${ext}.ts`;
              const mapFile = `${dtsFile}.map`;
              const generator = new SourceMapGenerator({
                file: dtsFile,
                sourceRoot: empty,
              });

              const smc = sourceMap ? new SourceMapConsumer(sourceMap) : null;

              for (const [className /*, scoped*/] of Object.entries(classScope)) {
                const offset = classOffsets.get(className);

                if (offset) {
                  let { line, column } = offset;
                  let source = base;

                  if (smc) {
                    const {
                      line: l,
                      column: c,
                      source: s,
                    } = smc.originalPositionFor({ line, column });
                    if (l !== null && c !== null) {
                      line = l;
                      column = c;
                      if (s !== null) {
                        source = path.relative(dir, s);
                      }
                    }
                  }

                  generator.addMapping({
                    source,
                    generated: {
                      line: dts.length + 1, // account for the line we're about to add
                      column: 11, // length of {space.repeat(2)}readonly{space}{quote},
                    },
                    original: {
                      line,
                      column,
                    },
                  });
                }

                dts.push(
                  `${space.repeat(2)}readonly${space}${quote(className)}:${space}string;`, // ${quote(scoped)};`,
                );
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
              );

              return {
                files: {
                  [path.resolve(dir, dtsFile)]: dts.join('\n'),
                  [path.resolve(dir, mapFile)]: JSON.stringify(generator.toJSON()),
                },
                offsets: classOffsets,
              };
            });
        }),
    )
    .catch((e) => {
      logger?.error(e);
      throw e;
    });
}
