import { type Logger } from '../../common/index.ts';
import { type CssLocation } from '../../css-library/index.ts';

import { type ReadonlyUriSet } from '../helpers/index.ts';

export interface CssInformation {
  readonly classNames: ReadonlySet<string>;
  readonly locationsOfClassName: ReadonlyMap<string, readonly CssLocation[]>;
  readonly importedFiles: ReadonlyUriSet;
  readonly localClassNames: (localName: string) => ReadonlySet<string> | undefined;
  readonly hasDts: boolean;
  readonly writeTypeDefinition: (logger: Logger) => Promise<void>;
}
