#! /usr/bin/env node

import { cull, locatePackageRoot } from '@technobuddha/library';
import { Argument, Option, program } from 'commander';

import { FileIgnorer, LOGLEVELS, Optionator, remove, update, watch } from '../common/index.ts';

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
    .option('--extensions <extensions...>', 'File extensions to process')
    .option('--module-pattern <modulePattern>', 'Glob pattern to identify CSS modules')
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
          extensions,
          modulePattern,
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
              extensions,
              modulePattern,
              dtsHeader,
              dtsFooter,
            },
          }),
          { watch: action === 'watch' },
        );
        await using ignorer = await FileIgnorer.create({
          root,
          logger: optionator,
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
      },
    );

  await program.parseAsync();
}
