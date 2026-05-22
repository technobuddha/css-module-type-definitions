/**
 * Converts dash-separated segments in a string to camelCase-style capitalization.
 *
 * Consecutive dashes before an alphanumeric/underscore character are removed and the
 * following character is uppercased.
 *
 * @param word - The input string to normalize.
 * @returns The transformed string with dash-separated segments converted.
 *
 * @example
 * ```typescript
 * dashes('button-primary'); // 'buttonPrimary'
 * dashes('button--primary'); // 'buttonPrimary'
 * ```
 *
 * @group CSS Modules
 * @category Naming
 */
export function dashes(word: string): string {
  return word.replaceAll(/-+(\w)/gv, (_match: string, firstLetter: string) =>
    firstLetter.toUpperCase(),
  );
}
