import { isIdentifierPart, ScriptTarget } from 'typescript';

export function isExtendedIdentifier(sourceText: string, offset: number): boolean {
  const character = sourceText.codePointAt(offset);

  if (character === undefined) {
    return false;
  }

  if (character >= 0xdc00 && character <= 0xdfff && offset > 0) {
    const previous = sourceText.codePointAt(offset - 1);
    if (previous !== undefined && previous > 0xffff) {
      return isIdentifierPart(previous, ScriptTarget.Latest);
    }
  }

  return isIdentifierPart(character, ScriptTarget.Latest);
}
