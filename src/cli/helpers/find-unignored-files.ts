import fs from 'node:fs/promises';

import { type Ignore } from 'ignore';

export async function findUnignoredFiles(glob: string, ig: Ignore): Promise<string[]> {
  const files: string[] = [];

  for await (const file of fs.glob(`**/${glob}`)) {
    if (!ig.ignores(file)) {
      files.push(file);
    }
  }

  return files;
}
