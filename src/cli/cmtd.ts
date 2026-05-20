#! /usr/bin/env node
import fs from 'node:fs/promises';

import { splitLines } from '@technobuddha/library';
import ignore from 'ignore';
import { type UserConfig } from 'vite';

import { defaultOptions, type Options } from '../common/index.ts';

import { remove } from './remove.ts';
import { update } from './update.ts';

if (import.meta.main) {
  await import('commander').then(async ({ program }) => {
    let viteConfig: UserConfig['css'] = undefined;

    for (const extension of ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts']) {
      const vite: UserConfig | undefined = await import(`vite.config.${extension}`)
        .then((mod) => mod.default ?? mod)
        .catch(() => undefined);
      if (vite) {
        viteConfig = vite.css;
        break;
      }
    }
    if (viteConfig?.modules === false) {
      viteConfig.modules = undefined;
    }
    if (typeof viteConfig?.modules?.generateScopedName === 'function') {
      delete viteConfig.modules.generateScopedName;
    }
    if (typeof viteConfig?.modules?.localsConvention === 'function') {
      delete viteConfig.modules.localsConvention;
    }

    const cmtdSettings: Record<string, unknown> = await fs
      .readFile('.vscode/settings.json', 'utf-8')
      .then((json) => JSON.parse(json))
      .then((settings) =>
        Object.fromEntries(
          Object.entries(settings)
            .filter(([key]) => key.startsWith('cmtd.'))
            .map(([key, value]) => [key.slice(5), value]),
        ),
      )
      .catch(() => ({}));

    const options: Options = {
      preprocessor: {
        less: viteConfig?.preprocessorOptions?.less,
        sass: viteConfig?.preprocessorOptions?.sass,
        scss: viteConfig?.preprocessorOptions?.scss,
        styl: viteConfig?.preprocessorOptions?.styl,
        stylus: viteConfig?.preprocessorOptions?.stylus,
      },
      cssModules: {
        scopeBehaviour:
          (cmtdSettings[
            'cssModules.scope.scopeBehaviour'
          ] as Options['cssModules']['scopeBehaviour']) ??
          viteConfig?.modules?.scopeBehaviour ??
          defaultOptions.cssModules.scopeBehaviour,
        globalModulePaths:
          (cmtdSettings[
            'cssModules.globalModulePaths'
          ] as Options['cssModules']['globalModulePaths']) ??
          viteConfig?.modules?.globalModulePaths ??
          defaultOptions.cssModules.globalModulePaths,
        exportGlobals:
          (cmtdSettings['cssModules.exportGlobals'] as Options['cssModules']['exportGlobals']) ??
          viteConfig?.modules?.exportGlobals ??
          defaultOptions.cssModules.exportGlobals,
        generateScopedName:
          (cmtdSettings[
            'cssModules.generateScopedName'
          ] as Options['cssModules']['generateScopedName']) ??
          viteConfig?.modules?.generateScopedName ??
          defaultOptions.cssModules.generateScopedName,
        hashPrefix:
          (cmtdSettings['cssModules.hashPrefix'] as Options['cssModules']['hashPrefix']) ??
          viteConfig?.modules?.hashPrefix ??
          defaultOptions.cssModules.hashPrefix,
        localsConvention:
          (cmtdSettings[
            'cssModules.localsConvention'
          ] as Options['cssModules']['localsConvention']) ??
          viteConfig?.modules?.localsConvention ??
          defaultOptions.cssModules.localsConvention,
        dtsBanner:
          (cmtdSettings['cssModules.dtsBanner'] as Options['cssModules']['dtsBanner']) ??
          defaultOptions.cssModules.dtsBanner,
        dtsHeader:
          (cmtdSettings['cssModules.dtsHeader'] as Options['cssModules']['dtsHeader']) ??
          defaultOptions.cssModules.dtsHeader,
        generateDtsOnSave:
          (cmtdSettings[
            'cssModules.generateDtsOnSave'
          ] as Options['cssModules']['generateDtsOnSave']) ??
          defaultOptions.cssModules.generateDtsOnSave,
        modulePattern:
          (cmtdSettings['cssModules.modulePattern'] as Options['cssModules']['modulePattern']) ??
          defaultOptions.cssModules.modulePattern,
        extensions:
          (cmtdSettings['cssModules.extensions'] as Options['cssModules']['extensions']) ??
          defaultOptions.cssModules.extensions,
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

    program.command('remove').action(async () => remove(globIsTypeDefinition, ig));
    program
      .command('update', { isDefault: true })
      .action(async () => update(options, globIsCss, ig));

    return program.parseAsync();
  });
}
