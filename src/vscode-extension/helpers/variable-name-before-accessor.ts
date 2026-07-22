import { isJsVariable } from '@technobuddha/library';
import { type TextDocument } from 'vscode';

import { codePointLength } from './code-point-length.ts';
import { isExtendedIdentifier } from './is-extended-identifier.ts';

export function variableNameBeforeAccessor(
  document: TextDocument,
  offset: number,
): { variableName: string; identifierOffset: number } | null {
  const sourceText = document.getText();

  let accessorOffset = offset - 1;
  while (accessorOffset >= 0 && /\s/v.test(sourceText[accessorOffset])) {
    accessorOffset--;
  }

  if (accessorOffset < 0) {
    return null;
  }

  const accessor = sourceText[accessorOffset];
  if (accessor === "'" || accessor === '"') {
    let bracketOffset = accessorOffset - 1;
    while (bracketOffset >= 0 && /\s/v.test(sourceText[bracketOffset])) {
      bracketOffset--;
    }

    if (bracketOffset < 0 || sourceText[bracketOffset] !== '[') {
      return null;
    }

    accessorOffset = bracketOffset;
  } else if (accessor !== '.' && accessor !== '[') {
    return null;
  }

  let endOffset = accessorOffset - 1;
  while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
    endOffset--;
  }

  if (
    accessor === '[' &&
    endOffset >= 1 &&
    sourceText[endOffset] === '.' &&
    sourceText[endOffset - 1] === '?'
  ) {
    endOffset -= 2;
    while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
      endOffset--;
    }
  } else if (accessor === '.' && endOffset >= 0 && sourceText[endOffset] === '?') {
    endOffset--;
    while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
      endOffset--;
    }
  }

  if (endOffset < 0) {
    return null;
  }

  let startOffset = endOffset;
  while (startOffset >= 0 && isExtendedIdentifier(sourceText, startOffset)) {
    startOffset -= codePointLength(sourceText, startOffset);
  }

  const variableName = sourceText.slice(startOffset + 1, endOffset + 1);
  if (!isJsVariable(variableName)) {
    return null;
  }

  return { variableName, identifierOffset: endOffset };
}
