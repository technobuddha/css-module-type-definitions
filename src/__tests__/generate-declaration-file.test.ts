/* eslint-disable @typescript-eslint/prefer-destructuring */
import fs from 'node:fs/promises';

import { generateDeclarationFile } from '../generate-declaration-file.ts';

// Mock modules
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('../extract-classnames.ts', () => ({
  extractClassnames: vi.fn(),
}));

vi.mock('prettier', () => ({
  format: vi.fn(async (content: string) => content),
  resolveConfig: vi.fn(async () => ({})),
}));

const { extractClassnames } = await import('../extract-classnames.ts');
const prettier = await import('prettier');

describe('generateDeclarationFile', () => {
  const testFile = '/test/test.module.css';
  const outputFile = `${testFile}.d.ts`;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock for readFile to return empty (file doesn't exist)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

    // Setup default mock for writeFile
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Reset prettier mock to default behavior (return input content)
    vi.mocked(prettier.format).mockImplementation(async (content: string) => content);

    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Basic functionality', () => {
    test('should generate declaration file with camelCase convention', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class', 'another-class']));

      await generateDeclarationFile(testFile, { localsConvention: 'camelCase' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        outputFile,
        expect.stringContaining('export type Classes'),
        'utf-8',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputFile,
        expect.stringContaining('"my-class"'),
        'utf-8',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputFile,
        expect.stringContaining('"myClass"'),
        'utf-8',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputFile,
        expect.stringContaining('export declare const myClass: string;'),
        'utf-8',
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        outputFile,
        expect.stringContaining('export declare const anotherClass: string;'),
        'utf-8',
      );
    });

    test('should generate declaration file with camelCaseOnly convention', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class', 'another-class']));

      await generateDeclarationFile(testFile, { localsConvention: 'camelCaseOnly' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"myClass"');
      expect(content).toContain('"anotherClass"');
      expect(content).not.toContain('"my-class"');
      expect(content).not.toContain('"another-class"');
    });

    test('should generate declaration file with dashes convention', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class', 'another-class']));

      await generateDeclarationFile(testFile, { localsConvention: 'dashes' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"my-class"');
      expect(content).toContain('"myClass"');
      expect(content).toContain('"another-class"');
      expect(content).toContain('"anotherClass"');
    });

    test('should generate declaration file with dashesOnly convention', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class', 'another-class']));

      await generateDeclarationFile(testFile, { localsConvention: 'dashesOnly' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"myClass"');
      expect(content).toContain('"anotherClass"');
      expect(content).not.toContain('"my-class"');
      expect(content).not.toContain('"another-class"');
    });

    test('should handle custom localsConvention function', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      const customConvention = vi.fn(() => 'customName');

      await generateDeclarationFile(testFile, { localsConvention: customConvention });

      expect(customConvention).toHaveBeenCalledWith('my-class', 'myClass', testFile);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"my-class"');
      expect(content).toContain('"customName"');
      expect(content).toContain('export declare const customName: string;');
    });

    test('should default to camelCase when no convention specified', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"my-class"');
      expect(content).toContain('"myClass"');
    });
  });

  describe('export filtering', () => {
    test('should only export valid JavaScript identifiers', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(
        new Set(['valid-class', 'class', '123invalid']),
      );

      await generateDeclarationFile(testFile, { localsConvention: 'camelCaseOnly' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      // validClass is a valid identifier
      expect(content).toContain('export declare const validClass: string;');

      // 'class' is a reserved word, should not be exported
      expect(content).not.toContain('export declare const class: string;');

      // '123invalid' is not a valid identifier
      expect(content).not.toContain('export declare const 123invalid: string;');

      // But all should be in the Classes type
      expect(content).toContain('"validClass"');
      expect(content).toContain('"class"');
    });

    test('should handle classes that become reserved words after conversion', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['for-loop']));

      await generateDeclarationFile(testFile, { localsConvention: 'camelCaseOnly' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      // forLoop is valid, 'for' is reserved
      expect(content).toContain('"forLoop"');
      expect(content).toContain('export declare const forLoop: string;');
    });
  });

  describe('file generation', () => {
    test('should include header comment in generated file', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['test']));

      await generateDeclarationFile(testFile);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('/* eslint-disable @typescript-eslint/naming-convention */');
      expect(content).toContain(
        'This file is automatically generated by css-module-type-definitions',
      );
    });

    test('should generate Locals type', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('export type Locals = { readonly [c in Classes]: string };');
    });

    test('should generate default export', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('declare const __default: Locals;');
      expect(content).toContain('export default __default;');
    });

    test('should handle empty class names', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set());

      await generateDeclarationFile(testFile);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    test('should generate never types for files with no classes', async () => {
      // When using camelCaseOnly, the classes array will be empty (no original names added)
      // but classNames.size > 0, so we generate a file with never types
      vi.mocked(extractClassnames).mockResolvedValue(
        new Set(['myClass']), // Already camelCase
      );

      await generateDeclarationFile(testFile, { localsConvention: 'camelCaseOnly' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      // When all class names are already in the target format with -Only convention,
      // the Classes type becomes just the class name, not never
      expect(content).toContain('"myClass"');
      expect(content).toContain('export declare const myClass: string;');
    });
  });

  describe('file system operations', () => {
    test('should write file when it does not exist', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await generateDeclarationFile(testFile);

      expect(fs.writeFile).toHaveBeenCalledWith(outputFile, expect.any(String), 'utf-8');
      expect(consoleLogSpy).toHaveBeenCalledWith('{CMTD} Types Generated for', testFile);
    });

    test('should write file when content has changed', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));
      vi.mocked(fs.readFile).mockResolvedValue('old content');

      await generateDeclarationFile(testFile);

      expect(fs.writeFile).toHaveBeenCalledWith(outputFile, expect.any(String), 'utf-8');
      expect(consoleLogSpy).toHaveBeenCalledWith('{CMTD} Types Generated for', testFile);
    });

    test('should not write file when content is unchanged', async () => {
      const content = 'unchanged content';
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));
      vi.mocked(fs.readFile).mockResolvedValue(content);

      // Mock format to return the same content
      const prettier = await import('prettier');
      vi.mocked(prettier.format).mockResolvedValue(content);

      await generateDeclarationFile(testFile);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should use correct output path', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      expect(fs.writeFile).toHaveBeenCalledWith(`${testFile}.d.ts`, expect.any(String), 'utf-8');
    });
  });

  describe('complex scenarios', () => {
    test('should handle multiple classes', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(
        new Set(['class-one', 'class-two', 'class-three']),
      );

      await generateDeclarationFile(testFile, { localsConvention: 'camelCase' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"class-one"');
      expect(content).toContain('"classOne"');
      expect(content).toContain('"class-two"');
      expect(content).toContain('"classTwo"');
      expect(content).toContain('"class-three"');
      expect(content).toContain('"classThree"');
      expect(content).toContain('export declare const classOne: string;');
      expect(content).toContain('export declare const classTwo: string;');
      expect(content).toContain('export declare const classThree: string;');
    });

    test('should handle classes with special characters', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(
        new Set(['my_class', 'my-class', 'my__class']),
      );

      await generateDeclarationFile(testFile, { localsConvention: 'camelCase' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"my_class"');
      expect(content).toContain('"myClass"');
    });

    test('should handle BEM-style class names', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(
        new Set(['block__element--modifier', 'block__element']),
      );

      await generateDeclarationFile(testFile, { localsConvention: 'dashes' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      expect(content).toContain('"block__element--modifier"');
      expect(content).toContain('"block__elementModifier"'); // dashes converts only dashes, not underscores
      expect(content).toContain('"block__element"');
    });

    test('should handle classes that are already camelCase', async () => {
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['myClass', 'anotherClass']));

      await generateDeclarationFile(testFile, { localsConvention: 'camelCase' });

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const contentStr = content as string;

      // When already camelCase, original and converted are the same
      expect(contentStr).toContain('"myClass"');
      expect(contentStr).toContain('"anotherClass"');
      // Should only appear once each in the union
      expect(contentStr.match(/"myClass"/gv)?.length).toBe(1);
      expect(contentStr.match(/"anotherClass"/gv)?.length).toBe(1);
    });
  });

  describe('prettier integration', () => {
    test('should call prettier format', async () => {
      const prettier = await import('prettier');
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      expect(prettier.format).toHaveBeenCalledWith(
        expect.stringContaining('export type Classes'),
        expect.objectContaining({ parser: 'typescript' }),
      );
    });

    test('should call prettier resolveConfig with output path', async () => {
      const prettier = await import('prettier');
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      expect(prettier.resolveConfig).toHaveBeenCalledWith(outputFile);
    });

    test('should merge prettier config with parser option', async () => {
      const prettier = await import('prettier');
      const prettierConfig = { tabWidth: 2, semi: false };
      vi.mocked(prettier.resolveConfig).mockResolvedValue(prettierConfig);
      vi.mocked(extractClassnames).mockResolvedValue(new Set(['my-class']));

      await generateDeclarationFile(testFile);

      expect(prettier.format).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ...prettierConfig,
          parser: 'typescript',
        }),
      );
    });
  });
});
