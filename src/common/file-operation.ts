import path from 'node:path';
import util from 'node:util';

type Operation = 'created' | 'updated' | 'deleted';

export function fileOperation(file: string, mode: Operation): string {
  const rFile = path.relative(process.cwd(), file);
  switch (mode) {
    case 'created': {
      return `${util.styleText('green', '[created]')} ${rFile}`;
    }
    case 'updated': {
      return `${util.styleText('yellow', '[updated]')} ${rFile}`;
    }
    case 'deleted': {
      return `${util.styleText('red', '[deleted]')} ${rFile}`;
    }
    // no default
  }
}
