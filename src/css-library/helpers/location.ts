import { type Position } from './position.ts';
import { Range } from './range.ts';

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
