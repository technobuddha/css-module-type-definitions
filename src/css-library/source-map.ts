import os from 'node:os';
import path from 'node:path';

import { empty, toError } from '@technobuddha/library';
import { type RawSourceMap, SourceMapConsumer } from 'source-map-js';

import { type Logger } from '../common/index.ts';

import { type MappedPosition, type Position } from './position.ts';

const reBadSource = /^(?:\.\.\/)+;charset=utf-8,/v;

export function originalPosition(
  smc: SourceMapConsumer,
  position: Position,
  file: string,
  logger: Logger,
): MappedPosition {
  try {
    let { line, column, source } = smc.originalPositionFor({
      line: position.line,
      column: position.column,
    });

    if (reBadSource.test(source)) {
      source = file;
    }

    if (line == null || column == null || source == null) {
      throw new Error(`Position ${position.line}:${position.column} not found.`);
    }

    return { line, column, source };
  } catch (e) {
    logger.error(toError(e), ' <== from originalPosition');
    throw e;
  }
}

type FixSourceMapOptions = {
  directory: string;
  relativeTo: string | 'home';
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

function fixSource(filename: string, { directory, relativeTo }: FixSourceMapOptions): string {
  let file = filename;

  if (relativeTo === 'directory') {
    file = path.resolve(directory, file);
  } else if (relativeTo === 'home') {
    file = path.resolve(os.homedir(), file);
  }

  return path.relative(directory, file);
}

export function dumpSourceMap(sourceMap: RawSourceMap | undefined): string {
  const output: string[] = [];

  if (sourceMap) {
    const smc = new SourceMapConsumer(sourceMap);

    smc.eachMapping((m) => {
      output.push(
        `${m.source} ${m.originalLine}:${m.originalColumn} => ${m.generatedLine}:${m.generatedColumn}${m.name ? ` (${m.name})` : empty}`,
      );
    });
  }
  return output.join('\n');
}
