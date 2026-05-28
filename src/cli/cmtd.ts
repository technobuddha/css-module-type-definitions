#! /usr/bin/env node
import { out, toError } from '@technobuddha/library';
import { program } from 'commander';

import {
  defaultOptions,
  Ignorer,
  type Logger,
  type Options,
  readViteConfig,
  readVSCodeSettings,
} from '../common/index.ts';

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

  const viteConfig = await readViteConfig(logger);
  const vscodeSettings = await readVSCodeSettings();

  const options: Options = {
    preprocessor: {
      less: viteConfig?.preprocessorOptions?.less ?? defaultOptions.preprocessor.less,
      sass: viteConfig?.preprocessorOptions?.sass ?? defaultOptions.preprocessor.sass,
      scss: viteConfig?.preprocessorOptions?.scss ?? defaultOptions.preprocessor.scss,
      styl: viteConfig?.preprocessorOptions?.styl ?? defaultOptions.preprocessor.styl,
      stylus: viteConfig?.preprocessorOptions?.stylus ?? defaultOptions.preprocessor.stylus,
    },
    cssModules: {
      scopeBehaviour:
        vscodeSettings.scopeBehaviour ??
        viteConfig?.modules?.scopeBehaviour ??
        defaultOptions.cssModules.scopeBehaviour,
      globalModulePaths:
        vscodeSettings.globalModulePaths ??
        viteConfig?.modules?.globalModulePaths ??
        defaultOptions.cssModules.globalModulePaths,
      exportGlobals:
        vscodeSettings.exportGlobals ??
        viteConfig?.modules?.exportGlobals ??
        defaultOptions.cssModules.exportGlobals,
      generateScopedName:
        vscodeSettings.generateScopedName ??
        viteConfig?.modules?.generateScopedName ??
        defaultOptions.cssModules.generateScopedName,
      hashPrefix:
        vscodeSettings.hashPrefix ??
        viteConfig?.modules?.hashPrefix ??
        defaultOptions.cssModules.hashPrefix,
      localsConvention:
        vscodeSettings.localsConvention ??
        viteConfig?.modules?.localsConvention ??
        defaultOptions.cssModules.localsConvention,
      dtsBanner: vscodeSettings.dtsBanner ?? defaultOptions.cssModules.dtsBanner,
      dtsHeader: vscodeSettings.dtsHeader ?? defaultOptions.cssModules.dtsHeader,
      dtsFooter: vscodeSettings.dtsFooter ?? defaultOptions.cssModules.dtsFooter,
      generateDtsOnSave:
        vscodeSettings.generateDtsOnSave ?? defaultOptions.cssModules.generateDtsOnSave,
      modulePattern: vscodeSettings.modulePattern ?? defaultOptions.cssModules.modulePattern,
      extensions: vscodeSettings.extensions ?? defaultOptions.cssModules.extensions,
    },
  };

  const globIsCss = `${options.cssModules.modulePattern}.{${options.cssModules.extensions.join(',')}}`;
  const globIsTypeDefinition = `${options.cssModules.modulePattern}.{${options.cssModules.extensions.map((ext) => `d.${ext},${ext}.d`).join(',')}}{.ts,.ts.map}`;

  {
    await using ignorer = new Ignorer(process.cwd(), { logger });

    program
      .command('update')
      .action(async () => update(globIsCss, globIsTypeDefinition, { ignorer, options, logger }));
    program
      .command('watch')
      .action(async () => watch(globIsCss, globIsTypeDefinition, { ignorer, options, logger }));
    program.command('remove').action(async () => remove(globIsTypeDefinition, ignorer, logger));

    await program.parseAsync();
  }
}
