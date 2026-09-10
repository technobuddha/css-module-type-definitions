export class Position {
  public readonly line: number;
  public readonly column: number;

  public constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }

  public add({ line, column }: Position | { line?: number; column: number }): Position {
    if (!line) {
      return new Position(this.line, this.column + column);
    }
    return new Position(this.line + (line ?? 0), column);
  }
}
