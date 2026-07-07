export function getCodeUnitLength(sourceText: string, offset: number): number {
  const character = sourceText.codePointAt(offset);

  if (character === undefined) {
    return 1;
  }

  if (character >= 0xdc00 && character <= 0xdfff && offset > 0) {
    const previous = sourceText.codePointAt(offset - 1);
    if (previous !== undefined && previous > 0xffff) {
      return 2;
    }
  }

  return 1;
}
