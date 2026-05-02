import { withIndex } from '@technobuddha/library';

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

  for (const [char, index] of withIndex(text)) {
    if (index <= offset) {
      if (char === '\n') {
        result.line++;
        result.column = 0;
      } else {
        result.column++;
      }
    } else {
      break;
    }
  }
  return result;
}

export function offsetAdd(base: Offset, delta: Offset): Offset {
  return {
    line: base.line + delta.line,
    column: base.column + delta.column,
  };
}
