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
import postcssModules from 'postcss-modules';
import { type RawSourceMap, SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger, type Options } from '../common/index.ts';

import { dashes } from './dashes.ts';
import { type Offset } from './offset.ts';
import { transformer } from './transformers/transformer.ts';

type GenerateTypesFromCssReturn = {
  dts: string[];
  dtsFile: string;
  map: RawSourceMap;
  offsets: Map<string, Offset>;
};

type GenerateTypesFromCssOptions = {
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

  return transformer(css, {
    filename,
    directory,
    options,
    compilerOptions,
    logger,
  })
    .then(async ({ css, sourceMap, classOffsets }) => {
      let classScope: Record<string, string>;

      return postcss([
        postcssModules({
          ...cssModules,
          getJSON: (cssFilename, json, outputFilename) => {
            classScope = json;
            return cssModules.getJSON?.(cssFilename, json, outputFilename ?? empty);
          },
        }),
      ])
        .process(css, { from: path.basename(filename), map: { inline: false, prev: sourceMap } })
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
              logger.error(
                `Could not find offset ${className} in ${filename} :: ${cssModules.localsConvention}`,
              );
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
            ...(cssModules.dtsBanner ? defaultBanner.map((line) => `// ${line}`) : []),
            ...splitLines(cssModules.dtsHeader ?? empty),
            empty,
            //`declare module "./${path.relative(directory, filename)}" {`,
            `${space.repeat(0)}type ${classname} = {`,
          ];

          const { name, ext, base } = path.parse(filename);
          const dtsFile = `${name}.d${ext}.ts`;
          // const dtsFile = `${name}${ext}.d.ts`;
          const generator = new SourceMapGenerator({
            file: dtsFile,
            sourceRoot: empty,
          });

          const smc = sourceMap ? new SourceMapConsumer(sourceMap) : null;

          for (const [className, scoped] of Object.entries(classScope)) {
            const offset = classOffsets.get(className);

            if (offset) {
              let { line, column } = offset;

              if (smc) {
                const { line: l, column: c } = smc.originalPositionFor({ line, column });
                if (l !== null && c !== null) {
                  line = l;
                  column = c;
                }
              }

              generator.addMapping({
                source: base,
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

            dts.push(`${space.repeat(2)}readonly${space}${quote(className)}: ${quote(scoped)};`);
          }

          dts.push(
            `${space.repeat(0)}};`,
            empty,
            `${space.repeat(0)}declare const ${variable}: ${classname};`,
            empty,
            `${space.repeat(0)}export default ${variable};`,
            //'};',
            //empty,
            //'export {};',
            empty,
          );

          return {
            dts: dts,
            dtsFile,
            map: generator.toJSON(),
            offsets: classOffsets,
          };
        });
    })
    .catch((e) => {
      logger?.error(e);
      throw e;
    });
}
