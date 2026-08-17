import os from 'node:os';
import path from 'node:path';

import { space, toError, unicodeLength } from '@technobuddha/library';
import chalk from 'chalk';
import { type URI } from 'vscode-uri';

type Operation =
  | 'error'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'diagnostics'
  | 'omit-add'
  | 'omit-change'
  | 'omit-unlink'
  | 'examined'
  | 'add'
  | 'change'
  | 'unlink'
  | 'opened'
  | 'closed'
  | 'edited';

export function fileOperation(file: string | URI, action: Operation, error?: unknown): string {
  const filename = typeof file === 'string' ? file : file.fsPath;
  const aFile = path.resolve(filename);
  const cFile = path.relative(process.cwd(), filename);
  const hFile = `~/${path.relative(os.homedir(), filename)}`;

  const display =
    aFile.length < cFile.length ?
      aFile.length < hFile.length ?
        aFile
      : hFile
    : cFile.length < hFile.length ? cFile
    : hFile;

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

    case 'omit-add':
    case 'omit-change':
    case 'omit-unlink':
    case 'diagnostics':
    case 'examined': {
      return `${chalk.blue(pad(`⟪${action}⟫`))} ${display}`;
    }

    case 'add':
    case 'change':
    case 'unlink': {
      return `${chalk.cyan(pad(`⟦${action}⟧`))} ${display}`;
    }

    case 'opened':
    case 'closed':
    case 'edited': {
      return `${chalk.magenta(pad(`【${action}】`))} ${display}`;
    }

    case 'error': {
      if (error) {
        return `${chalk.red(pad('[error]'))} ${display}: ${toError(error).message}`;
      }
      return `${chalk.red(pad('[error]'))} ${display}`;
    }

    // no default
  }
}

function pad(str: string): string {
  return `${str}${space.repeat(16 - unicodeLength(str))}`;
}
