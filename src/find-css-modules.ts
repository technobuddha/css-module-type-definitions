import fs from 'node:fs/promises';
import path from 'node:path';

import { type CMTDOptions } from './cmtd-options.ts';
import { generateDeclarationFile } from './generate-declaration-file.ts';

/**
 * Recursively finds and processes all CSS module files in a directory tree.
 *
 * This function searches for CSS module files matching the specified extension pattern,
 * starting from the root directory and traversing all subdirectories. For each matching
 * file, it generates a corresponding TypeScript declaration file.
 *
 * @param options - Configuration options for finding and processing CSS modules
 * @returns A promise that resolves to an array of results from generating declaration files
 *
 * @example
 * ```typescript
 * // Find all .module.css files in current directory
 * await findCssModules({ rootDirectory: './src' });
 *
 * // Find all .css files with custom extension
 * await findCssModules({
 *   rootDirectory: './src',
 *   extension: 'css',
 *   localsConvention: 'camelCase'
 * });
 * ```
 *
 * @group CSS Modules
 * @category File Discovery
 */
export async function findCssModules(
  options: CMTDOptions,
): Promise<Awaited<ReturnType<typeof generateDeclarationFile>>[]> {
  const { rootDirectory = process.cwd(), extension = 'module.css' } = options;

  const promises: Promise<void>[] = [];

  for await (const file of fs.glob(path.join(rootDirectory, '**', `*.${extension}`))) {
    promises.push(generateDeclarationFile(file, options));
  }

  return Promise.all(promises);
}
