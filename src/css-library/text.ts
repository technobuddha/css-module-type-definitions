import { Position, type Range } from './position.ts';

export class Text {
  readonly #source: string;

  public constructor(source: string) {
    this.#source = source;
  }

  public get text(): string {
    return this.#source;
  }

  public positionAt(offset: number): Position {
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
    return new Position(line, column);
  }

  public get size(): Position {
    return this.positionAt(-1).add({ column: 1 });
  }

  public increment(position: Position, amount: number): Position {
    return this.positionAt(this.offsetAt(position) + amount);
  }

  public offsetAt(position: Position): number {
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

  public range(range: Range): string {
    const offsetStart = this.offsetAt(range.start);
    const offsetEnd = this.offsetAt(range.end);

    return this.slice(offsetStart, offsetEnd);
  }

  public lines(start: number, end = start): string {
    const startOffset = this.offsetAt(new Position(start, 0));
    const endOffset = this.offsetAt(new Position(end + 1, 0));

    return this.slice(startOffset, endOffset);
  }
}
