import { empty } from '@technobuddha/library';
import { type RawSourceMap, SourceMapConsumer } from 'source-map-js';

export function dumpSourceMap(sourceMap: RawSourceMap | undefined): string {
  let x = empty;
  if (sourceMap) {
    const smc = new SourceMapConsumer(sourceMap);

    smc.eachMapping((mapping) => {
      const map = `${mapping.originalLine}:${mapping.originalColumn} -> ${mapping.generatedLine}:${mapping.generatedColumn}`;

      x += `${map}\n`;
    });
  }

  return x;
}
