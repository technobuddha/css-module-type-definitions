/**
 * Custom function type for transforming CSS class names.
 *
 * This function receives the original class name from the CSS file, the generated
 * camelCase version, and the input file path. It should return the desired class name
 * to be used in the TypeScript declaration.
 *
 * @example
 * ```typescript
 * const customConvention: LocalsConventionFunction = (original, generated, file) => {
 *   // Use SCREAMING_SNAKE_CASE
 *   return original.toUpperCase().replace(/-/g, '_');
 * };
 * ```
 *
 * @group Types
 * @category Options
 */
type LocalsConventionFunction = (
  /** The original class name as written in the CSS file */
  originalClassName: string,
  /** The automatically generated camelCase version of the class name */
  generatedClassName: string,
  /** The absolute path to the CSS module file being processed */
  inputFile: string,
) => string;

/**
 * Naming convention for exported class names in TypeScript declarations.
 *
 * Determines how CSS class names are transformed when generating TypeScript exports:
 *
 * - `'camelCase'`: Exports both the original kebab-case name and its camelCase version
 * - `'camelCaseOnly'`: Exports only the camelCase version, omitting the original
 * - `'dashes'`: Converts only dashes to camelCase (preserves underscores)
 * - `'dashesOnly'`: Like dashes, but exports only the converted version
 * - Custom function: Provides full control over the transformation
 *
 * @example
 * ```typescript
 * // With 'camelCase': .my-button becomes both "my-button" and "myButton"
 * // With 'camelCaseOnly': .my-button becomes only "myButton"
 * // With 'dashes': .my-button becomes "my-button" and "myButton", .my_button stays "my_button"
 * ```
 *
 * @group Types
 * @category Options
 */
type LocalsConvention =
  | 'camelCase'
  | 'camelCaseOnly'
  | 'dashes'
  | 'dashesOnly'
  | LocalsConventionFunction;

/**
 * Configuration options for CSS Module Type Definitions generation.
 *
 * These options control how CSS module files are discovered and how their
 * TypeScript declaration files are generated.
 *
 * @example
 * ```typescript
 * const options: CMTDOptions = {
 *   rootDirectory: './src',
 *   extension: 'module.css',
 *   localsConvention: 'camelCase'
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using a custom naming convention
 * const options: CMTDOptions = {
 *   rootDirectory: process.cwd(),
 *   localsConvention: (original, generated) => generated.toUpperCase()
 * };
 * ```
 *
 * @group Types
 * @category Options
 */
export type CMTDOptions = {
  /**
   * The root directory to search for CSS module files.
   *
   * All subdirectories will be recursively searched for files matching the extension pattern.
   *
   * @defaultValue `process.cwd()`
   */
  rootDirectory?: string;

  /**
   * The file extension pattern to match CSS module files.
   *
   * Files ending with this extension will be processed to generate type definitions.
   * Do not include the leading dot.
   *
   * @defaultValue `'module.css'`
   */
  extension?: string;

  /**
   * The naming convention for exported class names.
   *
   * Controls how CSS class names are transformed when generating TypeScript exports.
   * Can be a predefined string convention or a custom transformation function.
   *
   * @defaultValue `'camelCase'`
   */
  localsConvention?: LocalsConvention;
};
