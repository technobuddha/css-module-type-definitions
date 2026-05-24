#! /usr/bin/env node
import fs from 'node:fs/promises';

import { out, splitLines, toError } from '@technobuddha/library';
import ignore from 'ignore';

import { defaultOptions, type Logger, type Options } from '../common/index.ts';

import { readViteConfig, readVSCodeSettings } from './helpers/index.ts';
import { remove } from './remove.ts';
import { update } from './update.ts';
import { watch } from './watch.ts';

if (import.meta.main) {
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: (msg) => out(msg, '\n'),
    warn: (msg) => out(msg, '\n'),
    error: (error) => out(toError(error).message, '\n'),
  };

  await import('commander').then(async ({ program }) => {
    const viteConfig = await readViteConfig();
    const vscodeSettings = await readVSCodeSettings();

    const options: Options = {
      preprocessor: {
        less: viteConfig.preprocessorOptions?.less ?? defaultOptions.preprocessor.less,
        sass: viteConfig.preprocessorOptions?.sass ?? defaultOptions.preprocessor.sass,
        scss: viteConfig.preprocessorOptions?.scss ?? defaultOptions.preprocessor.scss,
        styl: viteConfig.preprocessorOptions?.styl ?? defaultOptions.preprocessor.styl,
        stylus: viteConfig.preprocessorOptions?.stylus ?? defaultOptions.preprocessor.stylus,
      },
      cssModules: {
        scopeBehaviour:
          vscodeSettings.scopeBehaviour ??
          viteConfig.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          vscodeSettings.globalModulePaths ??
          viteConfig.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          vscodeSettings.exportGlobals ??
          viteConfig.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          vscodeSettings.generateScopedName ??
          viteConfig.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          vscodeSettings.hashPrefix ??
          viteConfig.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          vscodeSettings.localsConvention ??
          viteConfig.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsBanner: vscodeSettings.dtsBanner ?? defaultOptions.cssModules.dtsBanner,
        dtsHeader: vscodeSettings.dtsHeader ?? defaultOptions.cssModules.dtsHeader,
        generateDtsOnSave:
          vscodeSettings.generateDtsOnSave ?? defaultOptions.cssModules.generateDtsOnSave,
        modulePattern: vscodeSettings.modulePattern ?? defaultOptions.cssModules.modulePattern,
        extensions: vscodeSettings.extensions ?? defaultOptions.cssModules.extensions,
      },
    };

    const globIsCss = `${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;
    const globIsTypeDefinition = `${options.cssModules.modulePattern}.{${options.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;

    const ig = ignore();
    await fs
      .readFile('.gitignore', 'utf-8')
      .then((data) =>
        splitLines(data)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#')),
      )
      .then((lines) => ig.add(lines));

    program
      .command('update')
      .action(async () => update(globIsCss, globIsTypeDefinition, { ig, options, logger }));
    program
      .command('watch')
      .action(async () => watch(globIsCss, globIsTypeDefinition, { ig, options, logger }));
    program.command('remove').action(async () => remove(globIsTypeDefinition, ig, logger));

    return program.parseAsync();
  });
}
