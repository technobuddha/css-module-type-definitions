export type CMTDPosition = {
  readonly line: number;
  readonly column: number;
};

export type CMTDMappedPosition = CMTDPosition & {
  readonly source: string;
};

export type CMTDRange = {
  readonly start: CMTDPosition;
  readonly end: CMTDPosition;
};

export type CMTDLocation = {
  readonly source: string;
  readonly range: CMTDRange;
};

export function positionOfOffset(text: string, offset: number): CMTDPosition {
  let line = 0;
  let column = 0;

  for (const char of text.slice(0, offset)) {
    if (char === '\n') {
      line++;
      column = 0;
    } else if (char === '\r') {
      // Ignore carriage returns, as they may be part of a CRLF sequence.
    } else {
      column++;
    }
  }
  return { line, column };
}

export function offsetOfPosition(text: string, position: CMTDPosition): number {
  let offset = 0;
  let line = 0;
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

export function positionAdd(base: CMTDPosition, delta: CMTDPosition): CMTDPosition {
  return {
    line: base.line + delta.line,
    column: base.column + delta.column,
  };
}
