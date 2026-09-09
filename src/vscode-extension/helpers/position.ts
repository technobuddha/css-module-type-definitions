import { Diagnostic, Location, Position, Range, Uri } from 'vscode';

import {
  type Diagnostic as CssDiagnostic,
  type Location as CssLocation,
  type Position as CssPosition,
  type Range as CssRange,
} from '../../css-library/index.ts';

export function toPosition(position: CssPosition): Position {
  return new Position(position.line, position.column);
}

export function toRange(range: CssRange): Range {
  return new Range(toPosition(range.start), toPosition(range.end));
}

export function toLocation(location: CssLocation): Location {
  return new Location(Uri.file(location.source), toRange(location.range));
}

export function toDiagnostic(diagnostic: CssDiagnostic): Diagnostic {
  return new Diagnostic(toRange(diagnostic.range), diagnostic.message, diagnostic.severity);
}
