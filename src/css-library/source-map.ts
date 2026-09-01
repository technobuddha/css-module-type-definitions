import path from 'node:path';

import { empty } from '@technobuddha/library';
import {
  type RawSourceMap,
  SourceMapConsumer as JSSourceMapConsumer,
  SourceMapGenerator as JSSourceMapGenerator,
} from 'source-map-js';

import { fileOperation, type Logger } from '../common/index.ts';

import { MappedPos, type Pos } from './position.ts';

// source-map-js uses line base-1 column base-0, so we need both to be base-0;

const reBadSource = /^(?:\.\.\/)+;charset=utf-8,/v;

type SMCArguments = {
  readonly sourceMap?: RawSourceMap;
  readonly source: string;
  readonly logger: Logger;
};

export class SourceMapConsumer {
  readonly #smc: JSSourceMapConsumer | undefined;
  readonly #source: string;
  readonly #logger: Logger;

  public constructor({ sourceMap, source, logger }: SMCArguments) {
    this.#smc = sourceMap ? new JSSourceMapConsumer(sourceMap) : undefined;
    this.#source = source;
    this.#logger = logger;
  }

  public originalPosition(position: Pos): MappedPos {
    if (this.#smc) {
      try {
        let { line, column, source } = this.#smc.originalPositionFor({
          line: position.line + 1,
          column: position.column,
        });

        if (reBadSource.test(source)) {
          source = this.#source;
        }

        if (line == null || column == null || source == null) {
          throw new Error(`Position ${position.line}:${position.column} not found.`);
        }

        return new MappedPos(line - 1, column, source);
      } catch (error) {
        this.#logger.error(fileOperation(this.#source, 'error', error));
        throw error;
      }
    }
    return new MappedPos(position.line, position.column, this.#source);
  }
}

type SMGArguments = {
  readonly file: string;
  readonly logger: Logger;
};

type AddMappingArguments = {
  readonly source: string;
  readonly generated: Pos;
  readonly original: Pos;
};

export class SourceMapGenerator {
  readonly #smg: JSSourceMapGenerator;

  public constructor({ file }: SMGArguments) {
    this.#smg = new JSSourceMapGenerator({ file, sourceRoot: empty });
  }

  public addMapping({ source, generated, original }: AddMappingArguments): void {
    this.#smg.addMapping({
      source,
      generated: {
        line: generated.line + 1,
        column: generated.column,
      },
      original: {
        line: original.line + 1,
        column: original.column,
      },
    });
  }

  public sourceMap(): RawSourceMap {
    return this.#smg.toJSON();
  }
}

export function fixSourceMap(
  sourceMap: RawSourceMap | undefined,
  directory: string,
  relativeTo: string,
): RawSourceMap | undefined {
  if (sourceMap) {
    if (sourceMap.file) {
      sourceMap.file = path.relative(directory, path.resolve(relativeTo, sourceMap.file));
    }
    for (let i = 0; i < sourceMap.sources.length; i++) {
      sourceMap.sources[i] = path.relative(
        directory,
        path.resolve(relativeTo, sourceMap.sources[i]),
      );
    }
  }
  return sourceMap;
}

export function dumpSourceMap(sourceMap: RawSourceMap | undefined): string {
  const output: string[] = [];

  if (sourceMap) {
    const smc = new JSSourceMapConsumer(sourceMap);

    smc.eachMapping((m) => {
      output.push(
        `${m.source} ${m.originalLine}:${m.originalColumn} => ${m.generatedLine}:${m.generatedColumn}${m.name ? ` (${m.name})` : empty}`,
      );
    });
  }
  return output.join('\n');
}

const reSourceMap = /\n\s*\/[\/*][@#]\s*sourceMappingURL=[^\n]*/v;

export function removeInlineSourceMap(code: string): string {
  return code.replace(reSourceMap, empty);
}

export { type RawSourceMap } from 'source-map-js';
