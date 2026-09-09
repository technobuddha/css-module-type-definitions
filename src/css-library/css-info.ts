import { type Export, type ValueInformation } from './generate-css-global-info/index.ts';
import { type Location, type Range } from './position.ts';

export type CssGlobalInfo = {
  locationsOfAnimation: ReadonlyMap<string, readonly Location[]>;
  informationOfValues: ReadonlyMap<string, ValueInformation>;
  exports: ReadonlyMap<string, Export>;
  importedFiles: ReadonlySet<string>;
};

export type CssModuleInfo = CssGlobalInfo & {
  readonly dtsFilename: string;
  readonly dtsContents: string;
  readonly localNamesOfExport: ReadonlyMap<string, ReadonlySet<string>>;
  readonly scopeNameOfExportName: ReadonlyMap<string, string>;
  readonly exportNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;
  readonly dtsRange: ReadonlyMap<string, Range>;
  readonly hasDts: boolean;
};
