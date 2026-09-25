import path from 'node:path';

import {
  delimited,
  isWithinDirectory,
  searchParentSync,
  toRelativePath,
} from '@technobuddha/library';
import ts from 'typescript';
import { Uri } from 'vscode';

import { UriSet } from '../helpers/index.ts';

type Return = {
  modules: UriSet;
  packages: Set<string>;
};

export function scanImports(sourceFile: ts.SourceFile, root: Uri): Return {
  const filename = sourceFile.fileName;
  const dirname = path.dirname(filename);

  const imports: string[] = [];

  // <reference path="..." />
  for (const reference of sourceFile.referencedFiles) {
    imports.push(reference.fileName);
  }

  function visit(node: ts.Node): void {
    if (
      // import ... from '...'
      (ts.isImportDeclaration(node) ||
        // export ... from '...'
        ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }

    // require('...') or import('...')
    else if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        (ts.isIdentifier(expr) && expr.text === 'require') ||
        expr.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const [arg] = node.arguments;
        if (arg && ts.isStringLiteral(arg)) {
          imports.push(arg.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const searchResult = searchParentSync('tsconfig.json', {
    startDirectory: dirname,
    limit: 1,
  });

  const resolvedPaths: string[] = [];
  if (searchResult.length > 0) {
    const tsconfigPath = path.resolve(
      path.dirname(filename),
      searchResult[0].dir,
      searchResult[0].files[0],
    );

    // Load and parse tsconfig
    const configFile = ts.readConfigFile(tsconfigPath, (fileName) => ts.sys.readFile(fileName));
    if (configFile.error) {
      const errorMessage =
        typeof configFile.error.messageText === 'string' ?
          configFile.error.messageText
        : configFile.error.messageText.messageText;
      throw new Error(`Error reading tsconfig: ${errorMessage}`);
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(tsconfigPath),
    );

    // Create module resolution host
    const compilerOptions = parsedConfig.options;

    // Resolve each import
    for (const importSpec of imports) {
      const resolved = resolveImport(importSpec, root, dirname, filename, compilerOptions);

      if (resolved != null) {
        resolvedPaths.push(resolved);
      }
    }
  } else {
    for (const importSpec of imports) {
      const resolved = resolveImport(importSpec, root, dirname, filename);

      if (resolved != null) {
        resolvedPaths.push(resolved);
      }
    }
  }

  const modules = new UriSet();
  const packages = new Set<string>();

  for (const resolved of resolvedPaths) {
    if (resolved.startsWith('.')) {
      modules.add(Uri.file(path.resolve(dirname, resolved)));
    } else {
      packages.add(resolved);
    }
  }

  return {
    modules,
    packages,
  };
}

function resolveImport(
  importSpec: string,
  root: Uri,
  dirname: string,
  filename: string,
  compilerOptions?: ts.CompilerOptions,
): string | undefined {
  // Local imports
  if (importSpec.startsWith('.') || importSpec.startsWith('/')) {
    return toRelativePath(path.relative(dirname, path.resolve(dirname, importSpec)));
  }

  if (importSpec.startsWith('node:')) {
    return undefined;
  }

  const importPackage =
    importSpec.startsWith('@') ? delimited(importSpec, '/', 0, 2) : delimited(importSpec, '/', 0);

  if (compilerOptions) {
    const resolved = ts.resolveModuleName(importSpec, filename, compilerOptions, ts.sys);

    if (resolved.resolvedModule) {
      if (
        resolved.resolvedModule.resolvedFileName.includes('node_modules') ||
        !isWithinDirectory(root.fsPath, resolved.resolvedModule.resolvedFileName)
      ) {
        return importPackage;
      }

      return toRelativePath(
        path.relative(path.dirname(filename), resolved.resolvedModule.resolvedFileName),
      );
    }
  }

  return importPackage;
}
