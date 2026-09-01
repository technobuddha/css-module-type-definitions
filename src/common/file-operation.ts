import os from 'node:os';
import path from 'node:path';

import { toError } from '@technobuddha/library';
import chalk from 'chalk';
import { type URI } from 'vscode-uri';

import { pad } from './pad.ts';
import { toPathname } from './to-pathname.ts';

type Operation =
  | 'error'
  | 'warn'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'diagnostics'
  | 'examined'
  | 'add'
  | 'change'
  | 'note'
  | 'unlink'
  | 'opened'
  | 'closed'
  | 'edited';

export function fileOperation(file: string | URI, action: Operation, error?: unknown): string {
  const filename = toPathname(file);
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

    case 'note':
    case 'error':
    case 'warn': {
      if (error) {
        return `${chalk.red(pad(`〘〘${action}〙〙`))} ${display}: ${toError(error).message}`;
      }
      return `${chalk.red(pad(`〘〘${action}〙`))} ${display}`;
    }

    // no default
  }
}
