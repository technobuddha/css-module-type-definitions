import path from 'node:path';

import { searchParent } from '@technobuddha/library';
import {
  type CompilerOptions,
  parseJsonConfigFileContent,
  readConfigFile,
  resolveModuleName,
  sys,
} from 'typescript';
import { Uri } from 'vscode';

export async function resolveImportPath(
  filename: string,
  importModule: string,
): Promise<Uri | null> {
  if (importModule.startsWith('.') || importModule.startsWith('/')) {
    return Uri.file(path.resolve(path.dirname(filename), importModule));
  }

  let compilerOptions: CompilerOptions = {};

  const searchResult = await searchParent('tsconfig.json', {
    startDirectory: path.dirname(filename),
    limit: 1,
  });

  if (searchResult.length > 0) {
    const tsconfigPath = path.resolve(
      path.dirname(filename),
      searchResult[0].dir,
      searchResult[0].files[0],
    );

    // Load and parse tsconfig
    const configFile = readConfigFile(tsconfigPath, (filename) => sys.readFile(filename));
    if (configFile.error) {
      const errorMessage =
        typeof configFile.error.messageText === 'string' ?
          configFile.error.messageText
        : configFile.error.messageText.messageText;
      throw new Error(`Error reading tsconfig: ${errorMessage}`);
    }

    const parsedConfig = parseJsonConfigFileContent(
      configFile.config,
      sys,
      path.dirname(tsconfigPath),
    );

    // Create module resolution host
    compilerOptions = parsedConfig.options;
  }

  const resolved = resolveModuleName(importModule, filename, compilerOptions, sys);
  if (resolved.resolvedModule?.resolvedFileName) {
    return Uri.file(resolved.resolvedModule.resolvedFileName);
  }

  return null;
}
