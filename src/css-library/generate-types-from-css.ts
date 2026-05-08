import fs from 'node:fs/promises';
import path from 'node:path';

import {
  camelCase,
  defaultBanner,
  empty,
  isValidJsVariable,
  pascalCase,
  quote,
  space,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { type RawSourceMap, SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Options } from '../common/options.ts';

import { dashes } from './dashes.ts';
import { type Logger } from './logger.ts';
import { transformer } from './transformers/transformer.ts';

export type CSSTypes = {
  dts: string;
  map: RawSourceMap;
};

export async function generateTypesFromCss(
  filename: string,
  logger: Logger,
  options: Options = {},
): Promise<CSSTypes> {
  const directory = path.dirname(filename);
  const compilerOptions: CompilerOptions = {};

  const { cssModules: cssOptions = { localsConvention: 'camelCase' } } = options;

  return fs
    .readFile(filename, 'utf-8')
    .then(async (css) =>
      transformer(css, {
        filename,
        directory,
        options,
        compilerOptions,
        logger,
      }).then(async ({ css, sourceMap, classOffsets }) => {
        let classScope: Record<string, string>;

        return postcss([
          postcssModules({
            ...cssOptions,
            getJSON: (cssFilename, json, outputFilename) => {
              classScope = json;
              return cssOptions.getJSON?.(cssFilename, json, outputFilename ?? empty);
            },
          }),
        ])
          .process(css, { from: path.basename(filename), map: { inline: false, prev: sourceMap } })
          .then(({ map }) => {
            const sourceMap = map?.toJSON();

            let variable = camelCase(path.parse(filename).name.replace(/\.module$/v, empty));
            let classname = pascalCase(variable);
            if (!isValidJsVariable(variable)) {
              variable = camelCase(path.parse(filename).ext.replace(/^\./v, empty));
              classname = pascalCase(variable);
            }

            const dts: string[] = [
              ...defaultBanner.map((line) => `// ${line}`),
              '/* eslint-disable @typescript-eslint/naming-convention */',
              '// cspell:disable',
              empty,
              `type ${classname} = {`,
            ];

            const dtsFile = `${path.basename(filename)}.d.ts`;
            const source = path.parse(filename).base;
            const generator = new SourceMapGenerator({
              file: dtsFile,
              sourceRoot: empty,
            });

            const smc = sourceMap ? new SourceMapConsumer(sourceMap) : null;

            for (const [name, scoped] of Object.entries(classScope)) {
              let offset = classOffsets.get(name);

              // TODO look for camelCaseOnly and dashCaseOnly if offset is not found with the original name
              if (!offset && cssOptions.localsConvention !== 'camelCaseOnly') {
                for (const [n, o] of classOffsets.entries()) {
                  if (camelCase(n) === name) {
                    offset = o;
                    break;
                  }
                }
              }
              if (!offset && cssOptions.localsConvention !== 'dashesOnly') {
                for (const [n, o] of classOffsets.entries()) {
                  if (dashes(n) === name) {
                    offset = o;
                    break;
                  }
                }
              }

              if (offset) {
                let { line, column } = offset;

                if (smc) {
                  const { line: l, column: c } = smc.originalPositionFor({ line, column });
                  if (l !== null && c !== null) {
                    line = l;
                    column = c;
                  } else {
                    // TODO
                    // eslint-disable-next-line no-console
                    console.log(`Could not map position for ${name} at ${line}:${column}`);
                  }
                }

                generator.addMapping({
                  source,
                  generated: {
                    line: dts.length + 1, // account for the line we're about to add
                    column: 12, // length of {space}{space}readonly{space}{quote},
                  },
                  original: {
                    line,
                    column,
                  },
                });
              }

              dts.push(`${space}${space}readonly${space}${quote(name)}: ${quote(scoped)};`);
            }

            dts.push(
              '};',
              empty,
              `declare const ${variable}: ${classname};`,
              empty,
              `export default ${variable};`,
              empty,
            );

            return {
              dts: dts.join('\n'),
              map: generator.toJSON(),
            };
          });
      }),
    )
    .catch((e) => {
      logger?.error(e);
      throw e;
    });
}
