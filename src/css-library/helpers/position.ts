import { Range } from './range.ts';

type LC = { line?: number; column: number };

export class Position {
  public readonly line: number;
  public readonly column: number;

  public constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }

  public add(increment: Position | LC | number): Position;
  public add(increment: Range): Range;
  public add(increment: Position | LC | Range | number): Position | Range {
    if (increment instanceof Range) {
      return new Range(this.add(increment.start), this.add(increment.end));
    }

    if (typeof increment === 'number') {
      return new Position(this.line, this.column + increment);
    }

    const { line, column } = increment;

    if (!line) {
      return new Position(this.line, this.column + column);
    }
    return new Position(this.line + (line ?? 0), column);
  }
}
