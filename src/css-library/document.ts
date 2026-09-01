import { Pos } from './position.ts';

export class Document {
  readonly #source: string;

  public constructor(source: string) {
    this.#source = source;
  }

  public positionAt(offset: number): Pos {
    let line = 0;
    let column = 0;

    for (const char of this.#source.slice(0, offset)) {
      if (char === '\n') {
        line++;
        column = 0;
      } else if (char === '\r') {
        // Ignore carriage returns, as they may be part of a CRLF sequence.
      } else {
        column++;
      }
    }
    return new Pos(line, column);
  }

  public offsetAt(position: Pos): number {
    let offset = 0;
    let line = 0;
    let column = 0;

    for (const char of this.#source) {
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

  public slice(start: number, end?: number): string {
    return this.#source.slice(start, end);
  }

  public lines(start: number, end: number): string {
    const startOffset = this.offsetAt(new Pos(start, 0));
    const endOffset = this.offsetAt(new Pos(end + 1, 0));

    return this.slice(startOffset, endOffset);
  }
}
