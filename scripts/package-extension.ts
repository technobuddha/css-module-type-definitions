#!/usr/bin/env tsx
/* eslint-disable require-atomic-updates */
import fs from 'node:fs/promises';

import { type PackageJson } from 'type-fest';

// import { defaultOptions, type Options } from '../src/common/index.ts';
import { LOGLEVELS } from '../src/common/logger.ts';

if (import.meta.main) {
  await fs
    .readFile('./package.json', 'utf-8')
    .then(JSON.parse)
    .then(async (packageJson: PackageJson) => {
      packageJson.main = './extension.js';
      delete packageJson.types;
      delete packageJson.bin;
      delete packageJson.scripts;

      delete packageJson.technobuddhaProject;
      delete packageJson.packageManager;

      // engines...
      packageJson.engines ??= {};
      packageJson.engines.vscode = '^1.125.0';

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
            'cmtd.logLevel': {
              type: 'string',
              enum: LOGLEVELS,
              default: 'info',
              description: 'Logging level.',
            },
            'cmtd.showTypeFiles': {
              type: 'boolean',
              default: true,
              description: 'Whether to show type files in the explorer.',
            },
          },
        },
      };
      await fs.writeFile(
        './dist/vscode-extension/package.json',
        JSON.stringify(packageJson, null, 2),
        'utf-8',
      );

      packageJson.type = 'commonjs';
      packageJson.dependencies = Object.fromEntries(
        Object.entries(packageJson.dependencies ?? {}).filter(([key]) => key === 'stylus'),
      );
      //delete packageJson.dependencies;
      packageJson.devDependencies = {
        '@types/vscode': packageJson.devDependencies?.['@types/vscode'] ?? 'latest',
      };
      delete packageJson.resolutions;

      return fs.writeFile('./out/package.json', JSON.stringify(packageJson, null, 2), 'utf-8');
    });
}
