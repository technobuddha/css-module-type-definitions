#! /usr/bin/env node

import { cull, locatePackageRoot } from '@technobuddha/library';
import { Argument, Option, program } from 'commander';

import { LOGLEVELS } from '../common/index.ts';

import { Ignorer } from './ignorer.ts';
import { Optionator } from './optionator.ts';
import { remove } from './remove.ts';
import { update } from './update.ts';
import { watch } from './watch.ts';

if (import.meta.main) {
  program
    .addArgument(new Argument('<action>', 'Action').choices(['update', 'watch', 'remove']))
    .addOption(new Option('-l, --logLevel <logLevel>', 'Logging Level').choices(LOGLEVELS))
    .addOption(
      new Option('--scope-behaviour <scopeBehaviour>', 'Scope Behaviour').choices([
        'global',
        'local',
      ]),
    )
    .option('--global-module-paths <globalModulePaths...>', 'Paths to global modules')
    .option('--export-globals', 'Export global classes from CSS modules')
    .option(
      '--generate-scoped-name <generateScopedName>',
      'Pattern for generating scoped class names',
    )
    .option('--hash-prefix <hashPrefix>', 'Prefix for hash in generated class names')
    .addOption(
      new Option('--locals-convention <localsConvention>', 'Locals Convention').choices([
        'camelCase',
        'dashes',
        'dashesOnly',
        'camelCaseOnly',
        'asIs',
      ]),
    )
    .option('--dts-header <dtsHeader>', 'Content to include at the top of generated .d.ts files')
    .option('--dts-footer <dtsFooter>', 'Content to include at the bottom of generated .d.ts files')
    .action(
      async (
        action,
        {
          logLevel,
          scopeBehaviour,
          exportGlobals,
          generateScopedName,
          hashPrefix,
          localsConvention,
          dtsHeader,
          dtsFooter,
        },
      ) => {
        const root = (await locatePackageRoot()) ?? process.cwd();

        await using optionator = await Optionator.create(
          cull({
            logLevel,
            css: {
              modules: {
                scopeBehaviour,
                exportGlobals,
                generateScopedName,
                hashPrefix,
                localsConvention,
              },
              dtsHeader,
              dtsFooter,
            },
          }),
          { root, watch: action === 'watch' },
        );

        await using ignorer = await Ignorer.create({
          root,
          logger: optionator,
          watch: action === 'watch',
        });

        switch (action) {
          case 'update': {
            return await update({
              ignorer,
              root,
              logger: optionator.logger,
              options: optionator.options,
            });
          }
          case 'watch': {
            return await watch({ root, ignorer, optionator });
          }
          case 'remove': {
            return await remove({ ignorer, optionator });
          }
          // no default
        }
      },
    );

  await program.parseAsync();
}
