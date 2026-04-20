import fs from 'node:fs/promises';
import path from 'node:path';

import { findCssModules } from '../find-css-modules.ts';

// Mock modules
vi.mock('node:fs/promises', () => ({
  default: {
    glob: vi.fn(),
  },
}));

vi.mock('../generate-declaration-file.ts', () => ({
  generateDeclarationFile: vi.fn(),
}));

const { generateDeclarationFile } = await import('../generate-declaration-file.ts');

// Helper to create mock async generator with correct return type
async function* createMockGlob(files: string[]): AsyncGenerator<string, undefined, undefined> {
  for (const file of files) {
    yield file;
  }
  return undefined;
}

describe('findCssModules', () => {
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Restore original cwd if it was changed
    if (process.cwd() !== originalCwd) {
      process.chdir(originalCwd);
    }
  });

  describe('file discovery', () => {
    test('should find CSS module files with default extension', async () => {
      const mockFiles = [
        '/project/src/styles.module.css',
        '/project/src/components/Button.module.css',
      ];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({ rootDirectory: '/project' });

      expect(fs.glob).toHaveBeenCalledWith('/project/**/*.module.css');
      expect(generateDeclarationFile).toHaveBeenCalledTimes(2);
      expect(generateDeclarationFile).toHaveBeenCalledWith('/project/src/styles.module.css', {
        rootDirectory: '/project',
      });
      expect(generateDeclarationFile).toHaveBeenCalledWith(
        '/project/src/components/Button.module.css',
        { rootDirectory: '/project' },
      );
    });

    test('should find CSS files with custom extension', async () => {
      const mockFiles = ['/project/styles.css', '/project/theme.css'];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({ rootDirectory: '/project', extension: 'css' });

      expect(fs.glob).toHaveBeenCalledWith('/project/**/*.css');
      expect(generateDeclarationFile).toHaveBeenCalledTimes(2);
    });

    test('should use process.cwd() when rootDirectory not specified', async () => {
      const mockCwd = process.cwd();

      vi.mocked(fs.glob).mockReturnValue(createMockGlob([`${mockCwd}/styles.module.css`]) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({});

      expect(fs.glob).toHaveBeenCalledWith(`${mockCwd}/**/*.module.css`);
    });

    test('should handle empty results when no files found', async () => {
      vi.mocked(fs.glob).mockReturnValue(createMockGlob([]) as never);

      const result = await findCssModules({ rootDirectory: '/project' });

      expect(result).toEqual([]);
      expect(generateDeclarationFile).not.toHaveBeenCalled();
    });
  });

  describe('options propagation', () => {
    test('should pass localsConvention option to generateDeclarationFile', async () => {
      vi.mocked(fs.glob).mockReturnValue(createMockGlob(['/project/styles.module.css']) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({
        rootDirectory: '/project',
        localsConvention: 'camelCaseOnly',
      });

      expect(generateDeclarationFile).toHaveBeenCalledWith('/project/styles.module.css', {
        rootDirectory: '/project',
        localsConvention: 'camelCaseOnly',
      });
    });

    test('should pass custom localsConvention function', async () => {
      const customConvention = vi.fn((original: string) => original.toUpperCase());

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(['/project/styles.module.css']) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({
        rootDirectory: '/project',
        localsConvention: customConvention,
      });

      expect(generateDeclarationFile).toHaveBeenCalledWith('/project/styles.module.css', {
        rootDirectory: '/project',
        localsConvention: customConvention,
      });
    });

    test('should pass all options to generateDeclarationFile', async () => {
      vi.mocked(fs.glob).mockReturnValue(createMockGlob(['/project/styles.custom.css']) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      const options = {
        rootDirectory: '/project',
        extension: 'custom.css',
        localsConvention: 'dashes' as const,
      };

      await findCssModules(options);

      expect(generateDeclarationFile).toHaveBeenCalledWith('/project/styles.custom.css', options);
    });
  });

  describe('parallel processing', () => {
    test('should process all files in parallel', async () => {
      const mockFiles = ['/project/a.module.css', '/project/b.module.css', '/project/c.module.css'];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);

      let resolveCount = 0;
      vi.mocked(generateDeclarationFile).mockImplementation(
        async () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              resolveCount++;
              resolve();
            }, 10);
          }),
      );

      const result = await findCssModules({ rootDirectory: '/project' });

      expect(result).toHaveLength(3);
      expect(resolveCount).toBe(3);
      expect(generateDeclarationFile).toHaveBeenCalledTimes(3);
    });

    test('should wait for all files to complete', async () => {
      const mockFiles = ['/project/fast.module.css', '/project/slow.module.css'];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);

      const completed: string[] = [];

      vi.mocked(generateDeclarationFile).mockImplementation(async (file: string) => {
        const delay = file.includes('slow') ? 50 : 10;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay);
        });
        completed.push(file);
      });

      await findCssModules({ rootDirectory: '/project' });

      expect(completed).toHaveLength(2);
      expect(completed).toContain('/project/fast.module.css');
      expect(completed).toContain('/project/slow.module.css');
    });
  });

  describe('path handling', () => {
    test('should construct correct glob pattern', async () => {
      vi.mocked(fs.glob).mockReturnValue(createMockGlob([]) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({ rootDirectory: '/my/project', extension: 'scss' });

      expect(fs.glob).toHaveBeenCalledWith(path.join('/my/project', '**', '*.scss'));
    });

    test('should handle nested directory structures', async () => {
      const mockFiles = [
        '/project/src/styles.module.css',
        '/project/src/components/ui/Button.module.css',
        '/project/src/components/forms/Input.module.css',
        '/project/src/pages/home/styles.module.css',
      ];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);
      vi.mocked(generateDeclarationFile).mockResolvedValue(undefined);

      await findCssModules({ rootDirectory: '/project' });

      expect(generateDeclarationFile).toHaveBeenCalledTimes(4);
      for (const file of mockFiles) {
        expect(generateDeclarationFile).toHaveBeenCalledWith(file, { rootDirectory: '/project' });
      }
    });
  });

  describe('error handling', () => {
    test('should propagate errors from generateDeclarationFile', async () => {
      vi.mocked(fs.glob).mockReturnValue(createMockGlob(['/project/error.module.css']) as never);
      vi.mocked(generateDeclarationFile).mockRejectedValue(new Error('Generation failed'));

      await expect(findCssModules({ rootDirectory: '/project' })).rejects.toThrow(
        'Generation failed',
      );
    });

    test('should fail if any file fails', async () => {
      const mockFiles = ['/project/good.module.css', '/project/bad.module.css'];

      vi.mocked(fs.glob).mockReturnValue(createMockGlob(mockFiles) as never);
      vi.mocked(generateDeclarationFile).mockImplementation(async (file: string) => {
        if (file.includes('bad')) {
          throw new Error('Bad file');
        }
      });

      await expect(findCssModules({ rootDirectory: '/project' })).rejects.toThrow('Bad file');
    });
  });
});
