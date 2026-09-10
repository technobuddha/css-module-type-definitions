import { splitLines } from '@technobuddha/library';

import { type DtsInfo } from './dts-info.ts';

export function dtsTop({ classname, options }: DtsInfo): string[] {
  return [...splitLines(options.css.dtsHeader), `type ${classname} = {`];
}
