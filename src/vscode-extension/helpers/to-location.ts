import { Location, Uri } from 'vscode';

import { type Location as CssLocation } from '../../css-library/index.ts';

import { toRange } from './to-range.ts';

export function toLocation(location: CssLocation): Location {
  return new Location(Uri.file(location.source), toRange(location.range));
}
