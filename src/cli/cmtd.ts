#! /usr/bin/env node

import { locatePackageRoot } from '@technobuddha/library';
import { Argument, Option, program } from 'commander';

import {
  FileIgnorer,
  type LogLevel,
  LOGLEVELS,
  Optionator,
  remove,
  update,
  watch,
} from '../common/index.ts';

if (import.meta.main) {
  program
    .addArgument(new Argument('<action>', 'Action').choices(['update', 'watch', 'remove']))
    .addOption(new Option('-l, --logLevel <logLevel>').choices(LOGLEVELS))
    .action(async (action, { logLevel }: { logLevel: LogLevel }) => {
      const root = (await locatePackageRoot()) ?? process.cwd();

      await using optionator = await Optionator.create({ logLevel }, { watch: action === 'watch' });
      await using ignorer = await FileIgnorer.create({
        root,
        logger: optionator.logger,
        watch: action === 'watch',
      });

      switch (action) {
        case 'update': {
          return await update({ ignorer, optionator });
        }
        case 'watch': {
          return await watch({ root, ignorer, optionator });
        }
        case 'remove': {
          return await remove({ ignorer, optionator });
        }
        // no default
      }
    });

  await program.parseAsync();
}
