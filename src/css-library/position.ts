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

export class MappedPosition {
  public readonly source: string;
  public readonly position: Position;

  public constructor(source: string, line: number, column: number);
  public constructor(source: string, position: Position);
  public constructor(source: string, ...args: (number | Position)[]) {
    this.position =
      args.length === 1 ?
        new Position((args[0] as Position).line, (args[0] as Position).column)
      : new Position(args[0] as number, args[1] as number);
    this.source = source;
  }
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;

  public constructor(start: Position, end: Position);
  public constructor(startLine: number, startColumn: number, endLine: number, endColumn: number);
  public constructor(...args: (number | Position)[]) {
    if (args.length === 2) {
      this.start = args[0] as Position;
      this.end = args[1] as Position;
      return;
    }

    this.start = new Position(args[0] as number, args[1] as number);
    this.end = new Position(args[2] as number, args[3] as number);
  }
}

export class Location {
  public readonly source: string;
  public readonly range: Range;

  public constructor(source: string, range: Range);
  public constructor(source: string, start: Position, end: Position);
  public constructor(
    source: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  );
  public constructor(source: string, ...args: (Range | Position | number)[]) {
    this.source = source;
    if (args.length === 1) {
      this.range = args[0] as Range;
      return;
    }

    if (args.length === 2) {
      this.range = new Range(args[0] as Position, args[1] as Position);
      return;
    }

    this.range = new Range(
      args[0] as number,
      args[1] as number,
      args[2] as number,
      args[3] as number,
    );
  }
}
