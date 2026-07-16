import { isSurrogateLow } from '@technobuddha/library';

export function codePointLength(sourceText: string, offset: number): number {
  const character = sourceText.codePointAt(offset);
  if (character == null) {
    return 1;
  }

  if (offset > 0 && isSurrogateLow(character)) {
    const previous = sourceText.codePointAt(offset - 1);
    if (previous != null && previous > 0xffff) {
      return 2;
    }
  }

  return 1;
}
