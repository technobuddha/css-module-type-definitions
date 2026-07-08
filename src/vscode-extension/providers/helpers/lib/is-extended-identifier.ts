import { isSurrogateLow } from '@technobuddha/library';
import { isIdentifierPart, ScriptTarget } from 'typescript';

export function isExtendedIdentifier(sourceText: string, offset: number): boolean {
  const character = sourceText.codePointAt(offset);

  if (character === undefined) {
    return false;
  }

  if (offset > 0 && isSurrogateLow(character)) {
    const previous = sourceText.codePointAt(offset - 1);
    if (previous != null && previous > 0xffff) {
      return isIdentifierPart(previous, ScriptTarget.Latest);
    }
  }

  return isIdentifierPart(character, ScriptTarget.Latest);
}
