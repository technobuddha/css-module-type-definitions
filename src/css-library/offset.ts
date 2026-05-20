export interface Offset {
  /**
   * zero-based index
   */
  line: number;
  /**
   * zero-based index
   */
  column: number;
}

export function getPositionOfOffset(text: string, offset: number): Offset {
  const result: Offset = {
    line: 0,
    column: 0,
  };

  for (const char of text.slice(0, offset)) {
    if (char === '\n') {
      result.line++;
      result.column = -1;
    } else if (char === '\r') {
      // Ignore carriage returns, as they may be part of a CRLF sequence.
    } else {
      result.column++;
    }
  }
  return result.column < 0 ? { line: result.line, column: 0 } : result;
}

export function offsetAdd(base: Offset, delta: Offset): Offset {
  return {
    line: base.line + delta.line,
    column: base.column + delta.column,
  };
}
