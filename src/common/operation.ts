import { toError } from '@technobuddha/library';
import chalk from 'chalk';

type Operation = 'start' | 'finish' | 'do';

export function operation(display: string, mode: Operation, error?: unknown): string {
  if (error) {
    return `${chalk.red(`[${mode}]`.padEnd(16))} ${display}\n${chalk.red('[ERROR]'.padEnd(16))} ${toError(error).message}`;
  }

  switch (mode) {
    case 'start': {
      return `${chalk.green('[start]'.padEnd(16))} ${display}`;
    }

    case 'finish': {
      return `${chalk.yellow('[finish]'.padEnd(16))} ${display}`;
    }

    case 'do': {
      return `${chalk.gray('[do]'.padEnd(16))} ${display}`;
    }

    // no default
  }
}
