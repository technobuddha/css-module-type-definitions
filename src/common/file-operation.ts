import path from 'node:path';
import util from 'node:util';

type Operation = 'created' | 'updated' | 'deleted' | 'configuration' | 'add' | 'change' | 'unlink';

export function fileOperation(file: string, mode: Operation): string {
  const rFile = path.relative(process.cwd(), file);
  switch (mode) {
    case 'created': {
      return `${util.styleText('green', '[created]'.padEnd(16))} ${rFile}`;
    }

    case 'updated': {
      return `${util.styleText('yellow', '[updated]'.padEnd(16))} ${rFile}`;
    }

    case 'deleted': {
      return `${util.styleText('red', '[deleted]'.padEnd(16))} ${rFile}`;
    }

    case 'configuration': {
      return `${util.styleText('blue', '⟦configuration⟧'.padEnd(16))} ${rFile}`;
    }

    case 'add':
    case 'change':
    case 'unlink': {
      return `${util.styleText('cyan', `⟦${mode}⟧`.padEnd(16))} ${rFile}`;
    }

    // no default
  }
}
