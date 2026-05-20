import fs from 'node:fs/promises';

import { type Ignore } from 'ignore';

import { findUnignoredFiles } from './find-unignored-files.ts';

export async function remove(glob: string, ig: Ignore): Promise<void> {
  await findUnignoredFiles(glob, ig).then(async (files) =>
    Promise.all(files.map(async (file) => fs.rm(file))),
  );
}
