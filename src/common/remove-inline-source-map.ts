import { empty } from '@technobuddha/library';

const reSourceMap = /\n\s*\/[\/*][@#]\s*sourceMappingURL=[^\n]*/v;

export function removeInlineSourceMap(code: string): string {
  return code.replace(reSourceMap, empty);
}
