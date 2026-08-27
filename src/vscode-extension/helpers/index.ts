export { canonicalPath } from './canonical-path.ts';
export { codePointLength } from './code-point-length.ts';
export { createLogger } from './create-logger.ts';
export { createRange } from './create-range.ts';
export {
  type AccessExpressionLike,
  type ElementAccessExpressionLike,
  isAccessExpressionLike,
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
  type PropertyAccessExpressionLike,
} from './expression.ts';
export { findAccessExpression } from './find-access-expression.ts';
export { findDeepestNodeAtPosition } from './find-deepest-node-at-position.ts';
export { getClassInfo } from './get-class-info.ts';
export { getImportInfo } from './get-import-info.ts';
export { getLocalInfo } from './get-local-info.ts';
export { getSourceFile } from './get-source-file.ts';
export { getTypeChecker } from './get-type-checker.ts';
export { importDeclarationModule } from './import-declaration-module.ts';
export { importEqualsModule } from './import-equals-module.ts';
export { importModuleFromDeclaration } from './import-module-from-declaration.ts';
export { isExtendedIdentifier } from './is-extended-identifier.ts';
export { isWithin } from './is-within.ts';
export { normalizeLocations } from './normalize-locations.ts';
export { propertyNameRange } from './property-name-range.ts';
export { replacementName } from './replacement-name.ts';
export { requireCallModule } from './require-call-module.ts';
export { resolveImportPath } from './resolve-import-path.ts';
export { scriptKind } from './script-kind.ts';
export { toDiagnosticSeverity } from './to-diagnostic-severity.ts';
export { unwrapExpression } from './unwrap-expression.ts';
export { ReadonlyUriMap, UriMap } from './uri-map.ts';
export { ReadonlyUriSet, UriSet } from './uri-set.ts';
export { variableNameBeforeAccessor } from './variable-name-before-accessor.ts';
export { vscodeFileExists } from './vscode-file-exists.ts';
