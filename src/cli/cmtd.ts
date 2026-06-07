#! /usr/bin/env node
import { noop, outln, toError } from '@technobuddha/library';
import { Argument, Option, program } from 'commander';

import { FileIgnorer, type Logger, Optionator } from '../common/index.ts';
import { remove, update, watch } from '../common/index.ts';

type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'off';
const LOGLEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warning: 3,
  error: 4,
  off: 5,
};

if (import.meta.main) {
  program
    .addArgument(new Argument('<action>', 'Action').choices(['update', 'watch', 'remove']))
    .addOption(
      new Option('-l, --log <logLevel>').choices([
        'off',
        'error',
        'warning',
        'info',
        'debug',
        'trace',
      ]),
    )
    .action(
      async (
        action,
        { log }: { log: 'off' | 'error' | 'warning' | 'info' | 'debug' | 'trace' },
      ) => {
        const level = LOGLEVELS[log] ?? 2;

        const logger: Logger = {
          trace: level <= 0 ? outln : noop,
          debug: level <= 1 ? outln : noop,
          info: level <= 2 ? outln : noop,
          warn: level <= 3 ? outln : noop,
          error: level <= 4 ? (error) => outln(toError(error).message) : noop,
        };

        await using ignorer = new FileIgnorer(process.cwd(), { logger, watch: action === 'watch' });
        await using optionator = await Optionator.create({}, { logger, watch: action === 'watch' });

        switch (action) {
          case 'update': {
            return await update({ ignorer, optionator, logger });
          }
          case 'watch': {
            return await watch({ ignorer, optionator, logger });
          }
          case 'remove': {
            return await remove({ ignorer, optionator, logger });
          }
          // no default
        }
      },
    );

  await program.parseAsync();
}
