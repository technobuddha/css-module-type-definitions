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
  toError,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger, type NormalizedOptions, removeInlineSourceMap } from '../common/index.ts';

import { BANNER_MESSAGE } from './constants.ts';
import { extractClassRangesFromCss, type ExtractedCss } from './extract-class-ranges-from-css.ts';

type GenerateTypesFromCssReturn = {
  files: Record<string, string>;
  classes: Map<string, ExtractedCss>;
};

export type GenerateTypesFromCssOptions = {
  options: NormalizedOptions;
  logger: Logger;
  compilerOptions?: CompilerOptions;
};

export async function generateTypesFromCss(
  css: string,
  filepath: string,
  { options, logger, compilerOptions = {} }: GenerateTypesFromCssOptions,
): Promise<GenerateTypesFromCssReturn> {
  const filename = path.resolve(filepath);
  // const directory = path.dirname(filename);

  const { cssModules } = options;

  return extractClassRangesFromCss(css, { file: filename, options, compilerOptions, logger }).then(
    async ({ css, classes }) => {
      let classScope: Record<string, string>;
      return postcss()
        .use(
          postcssModules({
            ...cssModules,
            getJSON: (_cssFilename, json, _outputFilename) => {
              classScope = json;
            },
          }),
        )
        .process(removeInlineSourceMap(css), {
          from: filename,
          map: { inline: false },
        })
        .then(() => {
          const scopeClass: Record<string, string[]> = {};
          for (const [className, scoped] of Object.entries(classScope)) {
            scopeClass[scoped] ??= [];
            scopeClass[scoped].push(className);
          }

          for (const classNames of Object.values(scopeClass)) {
            let extracted: ExtractedCss | undefined;
            for (const className of classNames) {
              const e = classes.get(className);
              if (e) {
                extracted ??= e;
              }
            }
            if (extracted) {
              for (const className of classNames) {
                classes.set(className, extracted);
              }
            } else {
              logger.warn(`No extracted range found for class names: ${classNames.join(', ')}`);
            }
          }

          const parsed = path.parse(filename);

          let variable = camelCase(parsed.name.replace(/\.module$/v, empty));
          let classname = pascalCase(variable);
          if (!isValidJsVariable(variable)) {
            variable = camelCase(parsed.ext.replace(/^\./v, empty));
            classname = pascalCase(variable);
          }

          const dts: string[] = [
            '// cspell:disable',
            '/* eslint eslint-comments/no-unlimited-disable: "off" */',
            '/* eslint-disable */',
            '{',
            ...defaultBanner(BANNER_MESSAGE).map((line) => `${space.repeat(2)}// ${line}`),
            '}',
            ...(cssModules.dtsHeader ? splitLines(cssModules.dtsHeader) : []),
            empty,
            '// prettier-ignore',
            `${space.repeat(0)}type ${classname} = {`,
          ];

          const { dir, name, ext } = path.parse(filename);
          const dtsFile = `${name}.d${ext}.ts`;
          const mapFile = `${dtsFile}.map`;

          const smg = new SourceMapGenerator({
            file: dtsFile,
            sourceRoot: empty,
          });

          // const smc1 = sourceMap1 ? new SourceMapConsumer(sourceMap1) : null;
          // const smc2 = sourceMap2 ? new SourceMapConsumer(sourceMap2) : null;

          type MappedClass = {
            source: string;
            line: number;
            column: number;
          };
          const mappedClasses = new Map<string, MappedClass>(
            classes.entries().map(([className, extracted]) => {
              const { source, start } = extracted;

              // if (smc2) {
              //   try {
              //     start = originalPosition(smc2, start, logger);
              //     // source = path.relative(dir, originalSource(smc2, start));
              //   } catch (e) {
              //     logger.error(toError(e));
              //   }
              // }

              // if (smc1) {
              //   try {
              //     start = originalPosition(smc1, start, logger);
              //   } catch (e) {
              //     logger.error(toError(e));
              //   }
              // }

              return [className, { source, ...start }];
            }),
          );

          for (const [className, extracted] of Array.from(mappedClasses).sort(
            ([, a], [, b]) => a.line - b.line || a.column - b.column,
          )) {
            const { source, line, column } = extracted;

            smg.addMapping({
              source,
              generated: {
                line: dts.length + 1, // account for the line we're about to add
                column: 11, // length of {space.repeat(2)}readonly{space}{quote},
              },
              original: { line, column },
            });

            dts.push(
              `${space.repeat(2)}readonly${space}${quote(className)}:${space}${quote(classScope[className])};`,
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
            ...splitLines(cssModules.dtsFooter ?? empty),
            empty,
          );

          return {
            files: {
              [path.resolve(dir, dtsFile)]: dts.join('\n'),
              [path.resolve(dir, mapFile)]: JSON.stringify(smg.toJSON()),
            },
            classes,
          };
        })
        .catch((error) => {
          logger.error(error);
          throw toError(error);
        });
    },
  );
}
