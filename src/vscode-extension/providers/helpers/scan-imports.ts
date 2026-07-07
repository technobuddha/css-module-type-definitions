import { toError } from '@technobuddha/library';
import {
  createSourceFile,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  type Node,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';
import { type Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

/**
 * Scans a TypeScript/JavaScript file and returns a list of resolved module paths,
 * including import and re-export module specifiers, with tsconfig path mapping resolution.
 * @param filePath - Path to the file to scan
 * @param fileContent - Optional file content (if already loaded)
 * @returns Array of resolved module paths
 */
export async function scanImports(code: Uri): Promise<Uri[]> {
  try {
    return await workspace.fs
      .readFile(code)
      .then(workspace.decode)
      .then((sourceText) => {
        const sourceFile = createSourceFile(code.fsPath, sourceText, ScriptTarget.Latest, true);
        const imports: Uri[] = [...visit(code, sourceFile)];
        return imports;
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Error scanning imports for ${code.fsPath}:`, toError(e));
    throw e;
  }
}

//   visit(sourceFile);

//   const searchResult = searchParentSync('tsconfig.json', {
//     startDirectory: fileDir,
//     limit: 1,
//   });

//   if (searchResult.length > 0) {
//     const tsconfigPath = path.resolve(
//       path.dirname(filePath),
//       searchResult[0].dir,
//       searchResult[0].files[0],
//     );

//     // Load and parse tsconfig
//     const configFile = ts.readConfigFile(tsconfigPath, (fileName) => ts.sys.readFile(fileName));
//     if (configFile.error) {
//       const errorMessage =
//         typeof configFile.error.messageText === 'string' ?
//           configFile.error.messageText
//         : configFile.error.messageText.messageText;
//       throw new Error(`Error reading tsconfig: ${errorMessage}`);
//     }

//     const parsedConfig = ts.parseJsonConfigFileContent(
//       configFile.config,
//       ts.sys,
//       path.dirname(tsconfigPath),
//     );

//     // Create module resolution host
//     const compilerOptions = parsedConfig.options;

//     // Resolve each import
//     const resolvedPaths: string[] = [];
//     for (const importSpec of imports) {
//       const resolved = resolveImport(importSpec, compilerOptions);

//       if (resolved != null) {
//         resolvedPaths.push(resolved);
//       }
//     }
//     return resolvedPaths;
//   }

//   const resolvedPaths: string[] = [];
//   for (const importSpec of imports) {
//     const resolved = resolveImport(importSpec);

//     if (resolved != null) {
//       resolvedPaths.push(resolved);
//     }
//   }

//   return resolvedPaths;
// }

function resolveImport(importSpec: string, file: Uri): Uri | undefined {
  // Local imports
  if (importSpec.startsWith('node:')) {
    return undefined;
  }

  if (importSpec.startsWith('.') || importSpec.startsWith('/')) {
    return Utils.resolvePath(Utils.dirname(file), importSpec);
  }

  return undefined;

  // const importPackage =
  //   importSpec.startsWith('@') ? delimited(importSpec, '/', 0, 2) : delimited(importSpec, '/', 0);

  // // if (compilerOptions) {
  // //   const resolved = ts.resolveModuleName(importSpec, file.fsPath, compilerOptions, ts.sys);

  // //   if (resolved.resolvedModule) {
  // //     if (
  // //       resolved.resolvedModule.resolvedFileName.includes('node_modules') ||
  // //       !isWithinDirectory(root, resolved.resolvedModule.resolvedFileName)
  // //     ) {
  // //       return importPackage;
  // //     }

  // //     return toRelativePath(
  // //       path.relative(path.dirname(filePath), resolved.resolvedModule.resolvedFileName),
  // //     );
  // //   }
  // // }

  // return importPackage;
}

function* visit(file: Uri, node: Node): Generator<Uri> {
  if (
    // import ... from '...'
    (isImportDeclaration(node) ||
      // export ... from '...'
      isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    isStringLiteral(node.moduleSpecifier)
  ) {
    const imported = resolveImport(node.moduleSpecifier.text, file);
    if (imported) {
      yield imported;
    }
  }

  // require('...') or import('...')
  else if (isCallExpression(node)) {
    const expr = node.expression;
    if ((isIdentifier(expr) && expr.text === 'require') || expr.kind === SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && isStringLiteral(arg)) {
        const imported = resolveImport(arg.text, file);
        if (imported) {
          yield imported;
        }
      }
    }
  }

  for (const child of node.getChildren()) {
    yield* visit(file, child);
  }
}
