import { space, unicodeLength } from '@technobuddha/library';

export function pad(str: string): string {
  return `${str}${space.repeat(16 - unicodeLength(str))}`;
}
