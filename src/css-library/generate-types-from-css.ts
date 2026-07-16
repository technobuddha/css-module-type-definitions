import path from 'node:path';

import {
  camelCase,
  defaultBanner,
  empty,
  isJsVariable,
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

export type CssInfo = {
  files: Record<string, string>;
  classes: Map<string, ExtractedCss[]>;
  includedFiles: Set<string>;
  aliases: Map<string, string[]>;
};

export type GenerateTypesFromCssOptions = {
  options: NormalizedOptions;
  logger: Logger;
  compilerOptions?: CompilerOptions;
};

export async function generateTypesFromCss(
  css: string,
  filepath: string,
  { options, logger }: GenerateTypesFromCssOptions,
): Promise<CssInfo> {
  const file = path.resolve(filepath);
  // const directory = path.dirname(filename);

  const { cssModules } = options;

  return extractClassRangesFromCss(css, { file, options, logger }).then(
    async ({ css, classes, includedFiles }) => {
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
          from: file,
          map: { inline: false },
        })
        .then(() => {
          const scopeClass: Record<string, string[]> = {};
          for (const [className, scoped] of Object.entries(classScope)) {
            scopeClass[scoped] ??= [];
            scopeClass[scoped].push(className);
          }

          const aliases: Map<string, string[]> = new Map();
          for (const classNames of Object.values(scopeClass)) {
            for (const className of classNames) {
              aliases.set(className, classNames);
            }
          }

          for (const classNames of Object.values(scopeClass)) {
            let extracted: ExtractedCss[] | undefined;
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

          const parsed = path.parse(file);

          let variable = camelCase(parsed.name.replace(/\.module$/v, empty));
          let classname = pascalCase(variable);
          if (!isJsVariable(variable)) {
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

          const { dir, name, ext } = path.parse(file);
          const dtsFile = `${name}.d${ext}.ts`;
          const mapFile = `${dtsFile}.map`;

          const smg = new SourceMapGenerator({
            file: dtsFile,
            sourceRoot: empty,
          });

          const classEntries = Array.from(
            classes,
            ([className, extracted]) => [className, extracted[0]] as const,
          ).sort(([, a], [, b]) => a.location.range.start.line - b.location.range.start.line || a.location.range.start.column - b.location.range.start.column);

          for (const [className, extracted] of classEntries) {
            const {
              location: {
              source,
                range: {
                  start: { line, column },
                },
              },
            } = extracted;

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
            includedFiles,
            aliases,
          };
        })
        .catch((error) => {
          logger.error(toError(error), ' <== From gtcss');
          throw toError(error);
        });
    },
  );
}
