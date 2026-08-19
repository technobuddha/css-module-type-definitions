import { toError } from '@technobuddha/library';
import chalk from 'chalk';

import { pad } from './pad.ts';

type Action = 'error' | 'start' | 'stop' | 'changed';

export function operation(display: string, action: Action, error?: unknown): string {
  switch (action) {
    case 'start': {
      return `${chalk.green(pad('[start]'))} ${display}`;
    }

    case 'stop': {
      return `${chalk.yellow(pad('[stop]'))} ${display}`;
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
