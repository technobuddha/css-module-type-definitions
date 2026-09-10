import {
  type Diagnostic,
  type Export,
  type ValueInformation,
} from './generate-css-global-info/index.ts';
import { type Location } from './position.ts';

export type CssGlobalInfo = {
  readonly locationsOfAnimation: ReadonlyMap<string, readonly Location[]>;
  readonly informationOfValues: ReadonlyMap<string, ValueInformation>;
  readonly exports: ReadonlyMap<string, Export>;
  readonly importedFiles: ReadonlySet<string>;
  readonly diagnostics: Diagnostic[];
  readonly localNamesOfExport: ReadonlyMap<string, ReadonlySet<string>>;
  readonly exportNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;
};

export type CssModuleInfo = CssGlobalInfo & {
  readonly dtsFilename: string;
  readonly dtsContents: string;
  readonly scopeNameOfExportName: ReadonlyMap<string, string>;
  readonly hasDts: boolean;
};
