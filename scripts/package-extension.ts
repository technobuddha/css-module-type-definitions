#!/usr/bin/env tsx
/* eslint-disable require-atomic-updates */
import fs from 'node:fs/promises';

import { type PackageJson } from 'type-fest';

import {
  CLASSCONVENTIONS,
  defaultOptions,
  LOGLEVELS,
  SEVERITYLEVELS,
} from '../src/common/index.ts';

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
      packageJson.icon = './assets/cmtd.png';
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
          title: 'CSS Module Type Definitions',
          type: 'object',
          properties: {
            'cmtd.logLevel': {
              type: 'string',
              enum: LOGLEVELS,
              default: defaultOptions.logLevel,
              description: 'Logging level.',
              order: 1,
            },
            'cmtd.unusedClassesDiagnostics': {
              type: 'string',
              enum: SEVERITYLEVELS,
              default: defaultOptions.unusedClassesDiagnostics,
              description: 'Severity level for unused classes diagnostics.',
              order: 2,
            },
            'cmtd.unusedImportedClassesDiagnostics': {
              type: 'boolean',
              default: defaultOptions.unusedImportedClassesDiagnostics,
              description: 'Whether to show diagnostics for unused imported classes.',
              order: 3,
            },
            'cmtd.css.dtsHeader': {
              type: 'string',
              editPresentation: 'multilineText',
              default: defaultOptions.css.dtsHeader,
              description: 'Header for generated type definition files.',
              order: 4,
            },
            'cmtd.css.dtsFooter': {
              type: 'string',
              editPresentation: 'multilineText',
              default: defaultOptions.css.dtsFooter,
              description: 'Footer for generated type definition files.',
              order: 5,
            },
            'cmtd.css.classesConvention': {
              type: 'string',
              default: defaultOptions.css.classesConvention,
              enum: CLASSCONVENTIONS,
              description: 'Convention for class names in generated type definition files.',
              order: 6,
            },

            'cmtd.showTypeFiles': {
              type: 'boolean',
              default: true,
              description: 'Whether to show type files in the explorer.',
              order: 99,
            },
          },
        },
        icons: {
          'cmtd-logo': {
            description: 'CMTD',
            default: {
              fontPath: './assets/cmtd.ttf',
              fontCharacter: '\\F000',
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
      // packageJson.dependencies = Object.fromEntries(
      //   Object.entries(packageJson.dependencies ?? {}).filter(([key]) => key === 'stylus'),
      // );
      delete packageJson.dependencies;
      packageJson.devDependencies = {
        '@types/vscode': packageJson.devDependencies?.['@types/vscode'] ?? 'latest',
      };
      delete packageJson.resolutions;

      return fs.writeFile('./out/package.json', JSON.stringify(packageJson, null, 2), 'utf-8');
    });
}
