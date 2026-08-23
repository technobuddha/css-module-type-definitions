import { type CssLocation } from '../../css-library/index.ts';

import { type ReadonlyUriSet } from '../helpers/index.ts';

export interface CssInformation {
  readonly classNames: ReadonlySet<string>;

  readonly locationsOfClass: ReadonlyMap<string, CssLocation[]>;
  readonly importedFiles: ReadonlyUriSet;
}
