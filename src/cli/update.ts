import fs from 'node:fs/promises';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import { type Ignore } from 'ignore';

import { type Options } from '../common/index.ts';
import { generateTypesFromCss } from '../css-library/index.ts';

import { findUnignoredFiles } from './find-unignored-files.ts';

export async function update(options: Options, glob: string, ig: Ignore): Promise<void> {
  return findUnignoredFiles(glob, ig)
    .then(async (files) =>
      Promise.all(
        files.map(async (file) => {
          const dir = path.dirname(file);

          return fs
            .readFile(file, 'utf-8')
            .then(async (content) =>
              generateTypesFromCss(content, file, { options, logger: console }).then(
                async ({ dts, dtsFile, map }) => {
                  const mapFile = `${dtsFile}.map`;

                  dts.push(`//# sourceMappingURL=${path.basename(mapFile)}`, empty);

                  return fs
                    .writeFile(path.join(dir, dtsFile), dts.join('\n'))
                    .then(async () => fs.writeFile(path.join(dir, mapFile), JSON.stringify(map)));
                },
              ),
            )
            .catch(() => {});
        }),
      ),
    )
    .then(() => undefined);
}
