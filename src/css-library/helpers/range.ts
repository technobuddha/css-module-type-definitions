import { Position } from './position.ts';

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
