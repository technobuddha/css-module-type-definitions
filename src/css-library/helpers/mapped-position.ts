import { Position } from './position.ts';

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
