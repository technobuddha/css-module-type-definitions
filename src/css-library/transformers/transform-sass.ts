import fs from 'node:fs';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import { compileStringAsync, type FileImporter /*, type Importer*/ } from 'sass';
import { URI } from 'vscode-uri';

// import { createMatchPath } from 'tsconfig-paths';
import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

const DEFAULT_EXTS = ['scss', 'sass', 'css'];

function resolveUrls(url: string, extensions: string[] = DEFAULT_EXTS): string[] {
  // We only care about tilde-prefixed imports that do not look like paths.
  if (!url.startsWith('~') || url.startsWith('~/')) {
    return [];
  }

  const modulePath = path.join('node_modules', url.slice(1));
  let variants = [modulePath];

  const parts = path.parse(modulePath);

  // Support sass partials by including paths where the file is prefixed by an underscore.
  if (!parts.base.startsWith('_')) {
    const underscoreName = '_'.concat(parts.name);
    const replacement = {
      root: parts.root,
      dir: parts.dir,
      ext: parts.ext,
      base: `${underscoreName}${parts.ext}`,
      name: underscoreName,
    };
    variants.push(path.format(replacement));
  }

  // Support index files.
  variants.push(path.join(modulePath, '_index'));

  // Create variants such that it has entries of the form
  // node_modules/@foo/bar/baz.(scss|sass)
  // for an import of the form ~@foo/bar/baz(.(scss|sass))?
  if (extensions.every((ext) => parts.ext !== `.${ext}`)) {
    variants = extensions.flatMap((ext) => variants.map((variant) => `${variant}.${ext}`));
  }

  return variants;
}

/**
 * Creates a sass importer which resolves Webpack-style tilde-imports.
 */
export const sassTildeImporter: FileImporter<'sync'> = {
  findFileUrl(url) {
    const searchPaths = resolveUrls(url);

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        return new URL(`file://${path.resolve(searchPath)}`);
      }
    }

    // Returning null is not itself an error, it tells sass to instead try the
    // next import resolution method if one exists
    return null;
  },
};

// function sassImporters(
//   directory: string,
//   paths?: Record<string, string[]>,
// ): (Importer<'async'> | FileImporter<'async'>)[] {
//   const matchPath = paths ? createMatchPath(path.resolve(directory), paths) : null;

//   return [
//     sassTildeImporter,
//     {
//       findFileUrl(url) {
//         const exactFileUrl = matchPath?.(url, undefined, undefined, ['.sass', '.scss']);

//         if (exactFileUrl) {
//           return new URL(`file://${exactFileUrl}`);
//         }

//         /*
//          * In case it didn't find the exact file it'll proceed to
//          * check other files matching the import process of Sass
//          * guidelines:
//          * https://sass-lang.com/documentation/at-rules/import/#partials
//          * https://sass-lang.com/documentation/at-rules/import/#index-files
//          */

//         // Checks for partials
//         const partialFileName = path.basename(url);
//         const partialDirName = path.dirname(url);
//         const partialFilePath = path.join(partialDirName, `_${partialFileName}`);
//         const partialFileUrl =
//           matchPath === null ? undefined : (
//             matchPath(partialFilePath, undefined, undefined, ['.sass', '.scss'])
//           );

//         if (partialFileUrl) {
//           return new URL(`file://${partialFileUrl}`);
//         }

//         // Checks for an _index file
//         const indexFilePath = path.join(partialDirName, partialFileName, `_index`);
//         const indexFileUrl =
//           matchPath === null ? undefined : (
//             matchPath(indexFilePath, undefined, undefined, ['.sass', '.scss'])
//           );

//         return indexFileUrl ? new URL(`file://${indexFileUrl}`) : null;
//       },
//     },
//   ];
// }

export async function transformSass(
  source: string,
  { filename, directory, options /*, compilerOptions*/ }: TransformerArguments,
): Promise<TransformerReturn> {
  const ext = path.parse(filename).ext.replace(/^\./v, empty) as 'scss' | 'sass';
  const { /*loadPaths = [],*/ additionalData, ...sassOptions } = options.preprocessor?.[ext] ?? {};
  // const { paths } = compilerOptions;

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    compileStringAsync(content, {
      //importers: sassImporters(directory, paths),
      //loadPaths: [directory, 'node_modules'], //, ...loadPaths],
      sourceMap: true,
      sourceMapIncludeSources: true,
      style: 'expanded',
      syntax: ext === 'sass' ? 'indented' : 'scss',
      url: new URL(`file://${filename}`),
      ...sassOptions,
    }).then(({ css, sourceMap }) => {
      if (sourceMap) {
        if (sourceMap.file) {
          sourceMap.file = path.relative(directory, URI.parse(sourceMap.file).fsPath);
        }

        for (let i = 0; i < sourceMap.sources.length; i++) {
          sourceMap.sources[i] = path.relative(directory, URI.parse(sourceMap.sources[i]).fsPath);
        }
      }
      return { css, sourceMap };
    }),
  );
}
