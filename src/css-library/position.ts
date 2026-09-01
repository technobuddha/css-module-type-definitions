export class Pos {
  public readonly line: number;
  public readonly column: number;

  public constructor(line: number, column: number) {
    this.line = line;
    this.column = column;
  }

  public add(delta: Pos): Pos {
    return new Pos(this.line + delta.line, this.column + delta.column);
  }
}

export class MappedPos extends Pos {
  public readonly source: string;

  public constructor(line: number, column: number, source: string) {
    super(line, column);
    this.source = source;
  }
}

export class PosRange {
  public readonly start: Pos;
  public readonly end: Pos;

  public constructor(start: Pos, end: Pos) {
    this.start = start;
    this.end = end;
  }
}

export class Loc {
  public readonly source: string;
  public readonly range: PosRange;

  public constructor(
    source: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number,
  ) {
    this.source = source;
    this.range = new PosRange(new Pos(startLine, startColumn), new Pos(endLine, endColumn));
  }
}
