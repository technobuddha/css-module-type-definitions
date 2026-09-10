import { type FileImporter, type Importer } from 'sass';

export type CssImporter = {
  less: Less.Plugin;
  css: (filename: string) => Promise<string>;
  sass: (FileImporter<'async'> | Importer<'async'>)[];
};
