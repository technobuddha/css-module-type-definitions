import { type Declaration, isVariableDeclaration } from 'typescript';

import { importDeclarationModule } from './import-declaration-module.ts';
import { importEqualsModule } from './import-equals-module.ts';
import { requireCallModule } from './require-call-module.ts';

export function importModuleFromDeclaration(declaration: Declaration): string | null {
  const idm = importDeclarationModule(declaration);
  if (idm) {
    return idm;
  }

  const iem = importEqualsModule(declaration);
  if (iem) {
    return iem;
  }

  if (isVariableDeclaration(declaration)) {
    return requireCallModule(declaration.initializer);
  }

  return null;
}
