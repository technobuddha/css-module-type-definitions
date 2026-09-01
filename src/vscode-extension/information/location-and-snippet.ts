import { Location, Position, Range, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type Loc } from '../../css-library/index.ts';

export class LocationAndSnippet extends Location {
  public readonly className: string;
  public readonly snippet: string;
  public constructor(location: Loc, importUri: Uri, className: string, snippet: string) {
    const { source, range } = location;
    super(
      Uri.joinPath(Utils.dirname(importUri), source),
      new Range(
        new Position(range.start.line, range.start.column),
        new Position(range.end.line, range.end.column),
      ),
    );
    this.className = className;
    this.snippet = snippet;
  }
}
