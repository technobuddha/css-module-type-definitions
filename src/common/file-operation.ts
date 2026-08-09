import os from 'node:os';
import path from 'node:path';

import { space, toError, unicodeLength } from '@technobuddha/library';
import chalk from 'chalk';

type Operation =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'configuration'
  | 'add'
  | 'change'
  | 'unlink'
  | 'ignored'
  | 'open'
  | 'close'
  | 'changed';

export function fileOperation(file: string, action: Operation, error?: unknown): string {
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

  if (error) {
    return `${chalk.red(pad(`[${action}]`))} ${display}\n${chalk.red(pad('[ERROR]'))} ${toError(error).message}`;
  }

  switch (action) {
    case 'created': {
      return `${chalk.green(pad('[created]'))} ${display}`;
    }

    case 'updated': {
      return `${chalk.yellow(pad('[updated]'))} ${display}`;
    }

    case 'deleted': {
      return `${chalk.red(pad('[deleted]'))} ${display}`;
    }

    case 'configuration': {
      return `${chalk.blue(pad('⟦configuration⟧'))} ${display}`;
    }

    case 'add':
    case 'change':
    case 'unlink': {
      return `${chalk.cyan(pad(`⟦${action}⟧`))} ${display}`;
    }

    case 'open':
    case 'close':
    case 'changed': {
      return `${chalk.green(pad(`【${action}】`))} ${display}`;
    }

    case 'ignored': {
      return `${chalk.gray(pad('︽ ignored ︾'))} ${display}`;
    }

    // no default
  }
}

function pad(str: string): string {
  return `${str}${space.repeat(16 - unicodeLength(str))}`;
}
