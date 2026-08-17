import os from 'node:os';
import path from 'node:path';

import { empty, toError } from '@technobuddha/library';
import {
  type RawSourceMap,
  SourceMapConsumer as JSSourceMapConsumer,
  SourceMapGenerator as JSSourceMapGenerator,
} from 'source-map-js';
import { URI } from 'vscode-uri';

import { type Logger } from '../common/index.ts';

import { type CMTDMappedPosition, type CMTDPosition } from './position.ts';

// source-map-js uses line base-1 column base-0, so we need to both base-0;

const reBadSource = /^(?:\.\.\/)+;charset=utf-8,/v;

type SMCArguments = {
  sourceMap?: RawSourceMap;
  source: string;
  logger: Logger;
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

  public originalPosition(position: CMTDPosition): CMTDMappedPosition {
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

        return { line: line - 1, column, source };
      } catch (e) {
        this.#logger.error(toError(e).message);
        throw e;
      }
    }
    return { line: position.line, column: position.column, source: this.#source };
  }
}

type SMGArguments = {
  file: string;
  logger: Logger;
};

type AddMappingArguments = {
  source: string;
  generated: CMTDPosition;
  original: CMTDPosition;
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

type FixSourceMapOptions = {
  directory: string;
  relativeTo: 'directory' | 'home' | 'uri';
  filename?: string;
  logger: Logger;
};

export function fixSourceMap(
  sourceMap: RawSourceMap | undefined,
  options: FixSourceMapOptions,
): RawSourceMap | undefined {
  if (sourceMap) {
    if (sourceMap.file) {
      sourceMap.file = fixSource(sourceMap.file, options);
    }
    for (let i = 0; i < sourceMap.sources.length; i++) {
      sourceMap.sources[i] = fixSource(sourceMap.sources[i], options);
    }
  }
  return sourceMap;
}

function fixSource(
  pathname: string,
  { directory, relativeTo, filename }: FixSourceMapOptions,
): string {
  let file = pathname;

  switch (relativeTo) {
    case 'directory': {
      file = path.resolve(directory, file);
      break;
    }

    case 'home': {
      file = path.resolve(os.homedir(), file);
      break;
    }

    case 'uri': {
      file = pathname.startsWith('data:') ? (filename ?? empty) : URI.parse(pathname).fsPath;
      break;
    }

    // no default
  }

  return path.relative(directory, file);
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

export { type RawSourceMap } from 'source-map-js';
