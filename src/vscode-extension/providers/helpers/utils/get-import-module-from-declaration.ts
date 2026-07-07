import { type Declaration, isVariableDeclaration } from 'typescript';

import { getImportDeclarationModule } from './get-import-declaration-module.ts';
import { getImportEqualsModule } from './get-import-equals-module.ts';
import { getRequireCallModule } from './get-require-call-module.ts';

export function getImportModuleFromDeclaration(declaration: Declaration): string | null {
  const importDeclarationModule = getImportDeclarationModule(declaration);
  if (importDeclarationModule) {
    return importDeclarationModule;
  }

  const importEqualsModule = getImportEqualsModule(declaration);
  if (importEqualsModule) {
    return importEqualsModule;
  }

  if (isVariableDeclaration(declaration)) {
    return getRequireCallModule(declaration.initializer);
  }

  return null;
}
