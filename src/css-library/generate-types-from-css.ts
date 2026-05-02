import fs from 'node:fs/promises';
import path from 'node:path';

import {
  camelCase,
  defaultBanner,
  empty,
  isValidJsVariable,
  quote,
  space,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { type RawSourceMap, SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { defaultLogger } from '../common/logger.ts';
import { type Options } from '../common/options.ts';

import { transformer } from './transformers/transformer.ts';

export type CSSTypes = {
  dts: string;
  map: RawSourceMap;
};

export async function generateTypesFromCss(filename: string): Promise<CSSTypes> {
  const directory = path.dirname(filename);
  const options: Options = {};
  const compilerOptions: CompilerOptions = {};
  const logger = defaultLogger;

  const {
    additionalData = empty,
    allowUnknownClassnames = false,
    namedExports = false,
    cssModules = {},
  } = options;

  return fs
    .readFile(filename, 'utf-8')
    .then(async (css) =>
      transformer(`${additionalData}${css}`, {
        filename,
        directory,
        options,
        compilerOptions,
        logger,
      }).then(async ({ css, sourceMap, classOffsets }) => {
        let classScope: Record<string, string>;

        return postcss([
          postcssModules({
            ...cssModules,
            getJSON: (cssFilename, json, outputFilename) => {
              classScope = json;
              cssModules.getJSON?.(cssFilename, json, outputFilename);
            },
          }),
        ])
          .process(css, { from: path.basename(filename), map: { inline: false, prev: sourceMap } })
          .then(({ map }) => {
            const sourceMap = map?.toJSON();

            let variable = camelCase(path.parse(filename).name.replace(/\.module$/v, empty));
            if (!isValidJsVariable(variable)) {
              variable = `__classes__`;
            }

            const dts: string[] = [
              ...defaultBanner.map((line) => `// ${line}`),
              '/* eslint-disable @typescript-eslint/naming-convention */',
              '// cspell:disable',
              empty,
              `declare const ${variable}:  {`,
            ];

            const dtsFile = `${path.basename(filename)}.d.ts`;
            const mapFile = `${path.basename(filename)}.map`;
            const source = path.parse(filename).base;
            const generator = new SourceMapGenerator({
              file: dtsFile,
              sourceRoot: empty,
            });

            const smc = sourceMap ? new SourceMapConsumer(sourceMap) : null;

            for (const [name, scoped] of Object.entries(classScope)) {
              const offset = classOffsets.get(name);
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

                dts.push(`${space}${space}readonly${space}${quote(name)}: ${quote(scoped)};`);
                generator.addMapping({
                  source,
                  generated: {
                    line: dts.length,
                    column: 12, // length of {space}{space}readonly{space}{quote},
                  },
                  original: {
                    line,
                    column,
                  },
                });
              }
            }

            if (allowUnknownClassnames) {
              dts.push('  [key: string]: string;');
            }
            dts.push('};', empty);

            if (namedExports) {
              dts.push(
                ...Object.entries(classScope)
                  .filter(([name]) => isValidJsVariable(name))
                  .map(([name, scope]) => `declare export const ${name}: ${quote(scope)}`),
              );
            }

            dts.push(
              `export default ${variable};`,
              empty,
              `//# sourceMappingURL=${mapFile}`,
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
