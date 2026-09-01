import { toError } from '@technobuddha/library';
import chalk from 'chalk';

import { pad } from './pad.ts';

type Action = 'error' | 'start' | 'ready' | 'stop' | 'changed';

export function operation(display: string, action: Action, error?: unknown): string {
  switch (action) {
    case 'start': {
      return `${chalk.grey(pad(`[${action}]`))} ${display}`;
    }

    case 'ready': {
      return `${chalk.green(pad(`[${action}]`))} ${display}`;
    }

    case 'stop': {
      return `${chalk.yellow(pad(`[${action}]`))} ${display}`;
    }

    case 'changed': {
      return `${chalk.gray(pad(`⟦${action}⟧`))} ${display}`;
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
