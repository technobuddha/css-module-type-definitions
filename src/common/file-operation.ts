import os from 'node:os';
import path from 'node:path';

import chalk from 'chalk';

type Operation =
  'created' | 'updated' | 'deleted' | 'configuration' | 'add' | 'change' | 'unlink' | 'ignored';

export function fileOperation(file: string, mode: Operation): string {
  const aFile = path.resolve(file);
  const cFile = path.relative(process.cwd(), file);
  const hFile = `~/${path.relative(os.homedir(), file)}`;

  const display =
    aFile.length < cFile.length ?
      aFile.length < hFile.length ?
        aFile
      : hFile
    : cFile.length < hFile.length ? cFile
    : hFile;

  switch (mode) {
    case 'created': {
      return `${chalk.green('[created]'.padEnd(16))} ${display}`;
    }

    case 'updated': {
      return `${chalk.yellow('[updated]'.padEnd(16))} ${display}`;
    }

    case 'deleted': {
      return `${chalk.red('[deleted]'.padEnd(16))} ${display}`;
    }

    case 'configuration': {
      return `${chalk.blue('⟦configuration⟧'.padEnd(16))} ${display}`;
    }

    case 'add':
    case 'change':
    case 'unlink': {
      return `${chalk.cyan(`⟦${mode}⟧`.padEnd(16))} ${display}`;
    }

    case 'ignored': {
      return `${chalk.gray('︽ ignored ︾'.padEnd(16))} ${display}`;
    }

    // no default
  }
}
