import { empty, splitLines } from '@technobuddha/library';

import { type DtsInfo } from './dts-info.ts';

export function dtsBottom({ options }: DtsInfo): string[] {
  return options.css.dtsFooter ? [empty, ...splitLines(options.css.dtsFooter), empty] : [empty];
}
