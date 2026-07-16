export type Position = {
  line: number;
  column: number;
};

export type MappedPosition = Position & {
  source: string;
};

export type Range = {
  start: Position;
  end: Position;
};

export type Location = {
  source: string;
  range: Range;
};

export function positionOfOffset(text: string, offset: number): Position {
  const result: Position = {
    line: 0,
    column: 0,
  };

  for (const char of text.slice(0, offset)) {
    if (char === '\n') {
      result.line++;
      result.column = 0;
    } else if (char === '\r') {
      // Ignore carriage returns, as they may be part of a CRLF sequence.
    } else {
      result.column++;
    }
  }
  return result;
}

export function offsetOfPosition(text: string, position: Position): number {
  let offset = 0;
  let line = 1;
  let column = 0;

  for (const char of text) {
    if (line === position.line && column === position.column) {
      return offset;
    }

    if (char === '\n') {
      if (line === position.line) {
        return offset;
      }

      line++;
      column = 0;
    } else if (char === '\r') {
      // Ignore carriage returns, as they may be part of a CRLF sequence.
    } else {
      column++;
    }

    offset++;
  }

  return offset;
}

export function positionAdd(base: Position, delta: Position): Position {
  return {
    line: base.line + delta.line,
    column: base.column + delta.column,
  };
}
