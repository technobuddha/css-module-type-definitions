export type CMTDPosition = {
  line: number;
  column: number;
};

export type CMTDMappedPosition = CMTDPosition & {
  source: string;
};

export type CMTDRange = {
  start: CMTDPosition;
  end: CMTDPosition;
};

export type CMTDLocation = {
  source: string;
  range: CMTDRange;
};

export function positionOfOffset(text: string, offset: number): CMTDPosition {
  const result: CMTDPosition = {
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
