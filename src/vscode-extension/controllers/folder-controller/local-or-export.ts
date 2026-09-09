export type LocalOrExport =
  { localName: string; exportName?: never } | { localName?: never; exportName: string };
