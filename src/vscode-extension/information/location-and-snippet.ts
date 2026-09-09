import { Location, Position, Range, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type Location as CssLocation } from '../../css-library/index.ts';

export class LocationAndSnippet extends Location {
  public readonly exportName: string;
  public readonly snippet: string;
  public constructor(location: CssLocation, importUri: Uri, exportName: string, snippet: string) {
    const { source, range } = location;
    super(
      Uri.joinPath(Utils.dirname(importUri), source),
      new Range(
        new Position(range.start.line, range.start.column),
        new Position(range.end.line, range.end.column),
      ),
    );
    this.exportName = exportName;
    this.snippet = snippet;
  }
}
