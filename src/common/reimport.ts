import fs from 'node:fs/promises';
import path from 'node:path';

import { dynamicImport, noop } from '@technobuddha/library';

export async function reImport<T = unknown>(file: string): Promise<T> {
  const { ext, dir } = path.parse(file);
  const tmpFile = path.join(dir, `cmtd${(Math.random() * 100000000000000).toFixed(0)}${ext}`);

  try {
    return await fs.cp(file, tmpFile).then(async () => dynamicImport<T>(tmpFile));
  } finally {
    await fs.rm(tmpFile, { force: true }).catch(noop);
  }
}
