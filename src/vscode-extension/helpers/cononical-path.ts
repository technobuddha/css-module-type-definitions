import fs from 'node:fs';
import path from 'node:path';

export function canonicalPath(filePath: string): string {
  try {
    return path.normalize(fs.realpathSync.native(filePath));
  } catch {
    return path.normalize(filePath);
  }
}
