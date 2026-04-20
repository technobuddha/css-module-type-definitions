/**
 * Set of JavaScript and TypeScript reserved words that cannot be used as unquoted identifiers.
 *
 * This includes keywords, literals, and strict mode reserved words that would cause syntax errors
 * if used as property names without quotes in TypeScript/JavaScript code.
 *
 * Based on ECMAScript 2025 specification (section 12.7.2).
 *
 * @internal
 */
const RESERVED_WORDS = new Set([
  // ECMAScript reserved words
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  // TypeScript-specific reserved words
  'as',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'type',
]);

/**
 * Validates whether a string is a valid JavaScript/TypeScript identifier that can be used
 * as an unquoted property name or variable name.
 *
 * A valid token must:
 * - Start with a letter (a-z, A-Z), dollar sign ($), or underscore (_)
 * - Contain only letters, digits, dollar signs, or underscores
 * - Not be a JavaScript/TypeScript reserved word
 *
 * @param token - The string to validate as a potential identifier
 * @returns `true` if the token is a valid identifier, `false` otherwise
 *
 * @example
 * ```ts
 * isValidToken('myClass');    // true
 * isValidToken('_private');   // true
 * isValidToken('$element');   // true
 * isValidToken('class123');   // true
 * isValidToken('class');      // false (reserved word)
 * isValidToken('123abc');     // false (starts with digit)
 * isValidToken('my-class');   // false (contains hyphen)
 * ```
 *
 * @group Utilities
 * @category Validation
 */
export function isValidToken(token: string): boolean {
  if (!/^[a-zA-Z$_][0-9a-zA-Z$_]*$/v.test(token)) {
    return false;
  }

  return !RESERVED_WORDS.has(token);
}
