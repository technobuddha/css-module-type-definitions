import { type Diagnostic, type Location } from 'vscode';

import { type Logger } from '../../common/index.ts';
import { type Export as CssExport } from '../../css-library/index.ts';

import { type ReadonlyUriSet } from '../helpers/index.ts';

import { type ValueInformation } from './value-information.ts';

export type Export = {
  readonly type: CssExport['type'];
  readonly location: readonly Location[];
  readonly snippet: string[];
};

export type Snippet = {
  readonly snippet: string;
  readonly exportName: string;
};

export interface CssInformation {
  readonly exportNames: ReadonlySet<string>;
  readonly locationsOfAnimation: ReadonlyMap<string, readonly Location[]>;
  readonly informationOfValues: ReadonlyMap<string, ValueInformation>;
  readonly exports: ReadonlyMap<string, Export>;
  readonly localNamesOfExport: ReadonlyMap<string, ReadonlySet<string>>;
  readonly exportNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;

  readonly importedFiles: ReadonlyUriSet;
  readonly localExportNames: (localName: string) => ReadonlySet<string> | undefined;
  readonly hasDts: boolean;
  readonly writeTypeDefinition: (logger: Logger) => Promise<void>;
  readonly diagnostics: readonly Diagnostic[];
}
