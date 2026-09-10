import { empty } from '@technobuddha/library';

import { type DtsInfo } from './dts-info.ts';

export function dtsMiddle({ classname, variable }: DtsInfo): string[] {
  return [
    '};',
    empty,
    `declare const ${variable}: ${classname};`,
    empty,
    `export default ${variable};`,
  ];
}
