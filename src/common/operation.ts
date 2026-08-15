import { toError } from '@technobuddha/library';
import chalk from 'chalk';

type Action = 'start' | 'stop' | 'changed';

export function operation(display: string, action: Action, error?: unknown): string {
  if (error) {
    return `${chalk.red(`[${action}]`.padEnd(16))} ${display}\n${chalk.red('[ERROR]'.padEnd(16))} ${toError(error).message}`;
  }

  switch (action) {
    case 'start': {
      return `${chalk.green('[start]'.padEnd(16))} ${display}`;
    }

    case 'stop': {
      return `${chalk.yellow('[stop]'.padEnd(16))} ${display}`;
    }

    case 'changed': {
      return `${chalk.gray(`⟦${action}⟧`.padEnd(16))} ${display}`;
    }

    // no default
  }
}
