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
  splitLines,
} from '@technobuddha/library';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { type RawSourceMap, SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger, type Options } from '../common/index.ts';

import { dashes } from './dashes.ts';
import { transformer } from './transformers/transformer.ts';

type GenerateTypesFromCssReturn = {
  dts: string;
  dtsFile: string;
  map: RawSourceMap;
};

type GenerateTypesFromCssOptions = {
  options: Options;
  logger: Logger;
  compilerOptions?: CompilerOptions;
};

export async function generateTypesFromCss(
  filename: string,
  { options, logger, compilerOptions = {} }: GenerateTypesFromCssOptions,
): Promise<GenerateTypesFromCssReturn> {
  const directory = path.dirname(filename);

  const { cssModules = {} } = options;

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
            ...cssModules,
            getJSON: (cssFilename, json, outputFilename) => {
              classScope = json;
              return cssModules.getJSON?.(cssFilename, json, outputFilename ?? empty);
            },
          }),
        ])
          .process(css, { from: path.basename(filename), map: { inline: false, prev: sourceMap } })
          .then(({ map }) => {
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
              `type ${classname} = {`,
            ];

            const { name, ext, base } = path.parse(filename);
            const dtsFile = `${name}${ext}.d.ts`;
            const generator = new SourceMapGenerator({
              file: dtsFile,
              sourceRoot: empty,
            });

            const smc = sourceMap ? new SourceMapConsumer(sourceMap) : null;

            for (const [className, scoped] of Object.entries(classScope)) {
              let offset = classOffsets.get(className);

              if (!offset && cssModules.localsConvention === 'camelCaseOnly') {
                for (const [n, o] of classOffsets.entries()) {
                  if (camelCase(n) === className) {
                    offset = o;
                    break;
                  }
                }
              }
              if (!offset && cssModules.localsConvention === 'dashesOnly') {
                for (const [n, o] of classOffsets.entries()) {
                  if (dashes(n) === className) {
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
                    logger.error(`Could not map position for ${className} at ${line}:${column}`);
                  }
                }

                generator.addMapping({
                  source: base,
                  generated: {
                    line: dts.length + 1, // account for the line we're about to add
                    column: 11, // length of {space}{space}readonly{space}{quote},
                  },
                  original: {
                    line,
                    column,
                  },
                });
              }

              dts.push(`${space}${space}readonly${space}${quote(className)}: ${quote(scoped)};`);
            }

            const comment = `//# sourceMappingURL=data:application/json;charset=utf-8;base64`;
            const b64SourceMap = Buffer.from(JSON.stringify(generator.toJSON())).toString('base64');
            dts.push(
              '};',
              empty,
              `declare const ${variable}: ${classname};`,
              empty,
              `export default ${variable};`,
              empty,
              `${comment},${b64SourceMap}`,
            );

            return {
              dts: dts.join('\n'),
              dtsFile,
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
