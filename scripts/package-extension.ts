#!/usr/bin/env tsx
import fs from 'node:fs/promises';

import { type PackageJson } from 'type-fest';

import { defaultOptions } from '../src/common/index.ts';

if (import.meta.main) {
  await fs
    .readFile('./package.json', 'utf-8')
    .then(JSON.parse)
    .then(async (packageJson: PackageJson) => {
      packageJson.type = 'commonjs';
      packageJson.main = './extension.js';
      delete packageJson.types;
      delete packageJson.bin;
      delete packageJson.scripts;
      delete packageJson.dependencies;
      packageJson.devDependencies = {
        '@types/vscode': packageJson.devDependencies?.['@types/vscode'] ?? 'latest',
      };
      delete packageJson.resolutions;
      delete packageJson.technobuddhaProject;
      delete packageJson.packageManager;

      packageJson.engines ??= {};
      packageJson.engines.vscode = '^1.120.0';
      // engines...
      packageJson.displayName = 'CSS Module Type Definitions';
      packageJson.preview = true;
      packageJson.icon = 'cmtd.png';
      packageJson.categories = ['Programming Languages', 'Other'];
      packageJson.publisher = 'technobuddha';
      packageJson.activationEvents = ['onStartupFinished'];
      packageJson.contributes = {
        commands: [
          {
            command: 'cmtd.generateTypes',
            title: 'CMTD: Generate Type Definitions',
          },
          {
            command: 'cmtd.deleteTypes',
            title: 'CMTD: Delete Generated Type Definitions',
          },
          {
            command: 'cmtd.updateTypes',
            title: 'CMTD: Update Type Definitions',
          },
          {
            command: 'cmtd.typeFiles.show',
            title: 'CMTD: Show Generated Type Definitions',
            icon: '$(filter-filled)',
          },
          {
            command: 'cmtd.typeFiles.hide',
            title: 'CMTD: Hide Generated Type Definitions',
            icon: '$(filter)',
          },
        ],
        menus: {
          'view/title': [
            {
              command: 'cmtd.typeFiles.show',
              group: 'navigation@21',
              when: "view == 'workbench.explorer.fileView' && !config.cmtd.showTypeFiles",
            },
            {
              command: 'cmtd.typeFiles.hide',
              group: 'navigation@21',
              when: "view == 'workbench.explorer.fileView' && config.cmtd.showTypeFiles",
            },
          ],
        },
        configuration: {
          type: 'object',
          title: 'CSS Module Type Definitions',
          properties: {
            'cmtd.cssModules.scopeBehaviour': {
              type: 'string',
              enum: ['global', 'local'],
              enumDescriptions: [
                'Treat all classes as globally scoped.',
                'Treat all classes as locally scoped.',
              ],
              default: defaultOptions.cssModules.scopeBehaviour,
              description: 'Generating scoped names',
            },
            'cmtd.cssModules.exportGlobals': {
              type: 'boolean',
              default: defaultOptions.cssModules.exportGlobals,
              description: 'Export global classes along with the local ones.',
            },
            'cmtd.cssModules.generateScopedName': {
              display: 'display',
              displayName: 'displayName',
              title: 'title',
              type: 'string',
              default: defaultOptions.cssModules.generateScopedName,
              description: 'Generating scoped names with a custom template. See',
            },
            'cmtd.cssModules.hashPrefix': {
              type: 'string',
              default: defaultOptions.cssModules.hashPrefix,
              description: 'Prefix for the hash in generated scoped names.',
            },
            'cmtd.cssModules.localsConvention': {
              type: 'string',
              enum: ['camelCase', 'camelCaseOnly', 'dashes', 'dashesOnly'],
              default: defaultOptions.cssModules.localsConvention,
              description: 'Generating scoped names',
            },
            'cmtd.cssModules.globalModulePaths': {
              type: 'array',
              items: {
                type: 'string',
                title: 'inner objects',
              },
              default: defaultOptions.cssModules.globalModulePaths.map((re) => re.source),
            },
            'cmtd.cssModules.extensions': {
              type: 'array',
              default: defaultOptions.cssModules.extensions,
              items: {
                type: 'string',
                title: 'File extension',
              },
              description: 'File extensions for CSS module files.',
            },
            'cmtd.cssModules.modulePattern': {
              type: 'string',
              default: defaultOptions.cssModules.modulePattern,
              description:
                'Glob pattern to identify CSS module files. This pattern is used to determine which CSS files should have corresponding .d.ts files generated.',
            },
            'cmtd.cssModules.dtsBanner': {
              type: 'boolean',
              default: defaultOptions.cssModules.dtsBanner,
              description:
                'Whether to include a banner comment at the top of generated .d.ts files.',
            },
            'cmtd.cssModules.dtsHeader': {
              type: 'string',
              default: defaultOptions.cssModules.dtsHeader,
              description:
                'Custom header comment to include at the top of generated .d.ts files. This can be used to disable specific linting rules or provide additional context for the generated type definitions.',
              editPresentation: 'multilineText',
            },
            'cmtd.cssModules.dtsFooter': {
              type: 'string',
              default: defaultOptions.cssModules.dtsFooter,
              description:
                'Custom footer comment to include at the bottom of generated .d.ts files. This can be used to disable specific linting rules or provide additional context for the generated type definitions.',
              editPresentation: 'multilineText',
            },
            'cmtd.cssModules.generateDtsOnSave': {
              type: 'boolean',
              default: defaultOptions.cssModules.generateDtsOnSave,
              description:
                'Whether to automatically generate .d.ts files for CSS modules when saving the corresponding CSS file.',
            },
            'cmtd.showTypeFiles': {
              type: 'boolean',
              default: true,
              description: 'Whether to show type files in the explorer.',
            },
          },
        },
      };

      return fs.writeFile('./out/package.json', JSON.stringify(packageJson, null, 2), 'utf-8');
    });
}
