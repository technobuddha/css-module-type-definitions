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

export function getPositionOfOffset(text: string, offset: number): Position {
  const result: Position = {
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

export function positionAdd(base: Position, delta: Position): Position {
  return {
    line: base.line + delta.line,
    column: base.column + delta.column,
  };
}
