import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { extractClassnames } from '../extract-classnames.ts';

describe('extractClassnames', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'extract-classnames-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic class extraction', () => {
    test('should extract single class name', async () => {
      const cssContent = '.button { color: blue; }';
      const filePath = path.join(tempDir, 'test.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('button')).toBeTrue();
    });

    test('should extract multiple class names', async () => {
      const cssContent = `
        .header { font-size: 2em; }
        .button { color: blue; }
        .footer { padding: 1em; }
      `;
      const filePath = path.join(tempDir, 'test.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBe(3);
      expect(result.has('header')).toBeTrue();
      expect(result.has('button')).toBeTrue();
      expect(result.has('footer')).toBeTrue();
    });

    test('should extract kebab-case class names', async () => {
      const cssContent = `
        .my-button { color: red; }
        .my-header { font-size: 2em; }
      `;
      const filePath = path.join(tempDir, 'test.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBe(2);
      expect(result.has('my-button')).toBeTrue();
      expect(result.has('my-header')).toBeTrue();
    });

    test('should extract class names with underscores', async () => {
      const cssContent = '.my_class { color: blue; }';
      const filePath = path.join(tempDir, 'test.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('my_class')).toBeTrue();
    });

    test('should handle empty CSS file', async () => {
      const cssContent = '';
      const filePath = path.join(tempDir, 'empty.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBe(0);
    });
  });

  describe('CSS features', () => {
    test('should handle nested selectors', async () => {
      const cssContent = `
        .parent {
          color: red;
          .child { color: blue; }
        }
      `;
      const filePath = path.join(tempDir, 'nested.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('parent')).toBeTrue();
      expect(result.has('child')).toBeTrue();
    });

    test('should handle pseudo-classes', async () => {
      const cssContent = `
        .button:hover { color: red; }
        .button:focus { color: blue; }
      `;
      const filePath = path.join(tempDir, 'pseudo.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button')).toBeTrue();
    });

    test('should handle media queries', async () => {
      const cssContent = `
        .responsive { width: 100%; }
        @media (min-width: 768px) {
          .responsive { width: 50%; }
        }
      `;
      const filePath = path.join(tempDir, 'media.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('responsive')).toBeTrue();
    });

    test('should handle multiple selectors on same rule', async () => {
      const cssContent = '.button, .link { color: blue; }';
      const filePath = path.join(tempDir, 'multiple.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button')).toBeTrue();
      expect(result.has('link')).toBeTrue();
    });

    test('should handle animations and keyframes', async () => {
      const cssContent = `
        .animated { animation: fadeIn 1s; }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      const filePath = path.join(tempDir, 'animation.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('animated')).toBeTrue();
    });
  });

  describe('CSS comments', () => {
    test('should handle single-line comments', async () => {
      const cssContent = `
        // This is a comment
        .button { color: blue; }
      `;
      const filePath = path.join(tempDir, 'comment.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button')).toBeTrue();
    });

    test('should handle multi-line comments', async () => {
      const cssContent = `
        /* This is a
           multi-line comment */
        .header { font-size: 2em; }
      `;
      const filePath = path.join(tempDir, 'comment.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('header')).toBeTrue();
    });

    test('should handle inline comments', async () => {
      const cssContent = '.button /* inline comment */ { color: blue; }';
      const filePath = path.join(tempDir, 'inline.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button')).toBeTrue();
    });
  });

  describe('special cases', () => {
    test('should ignore global classes', async () => {
      const cssContent = `
        :global(.global-class) { color: red; }
        .local-class { color: blue; }
      `;
      const filePath = path.join(tempDir, 'global.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('local-class')).toBeTrue();
      expect(result.has('global-class')).toBeFalse();
    });

    test('should handle BEM notation', async () => {
      const cssContent = `
        .block__element--modifier { color: blue; }
        .block__element { color: red; }
        .block { color: green; }
      `;
      const filePath = path.join(tempDir, 'bem.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('block__element--modifier')).toBeTrue();
      expect(result.has('block__element')).toBeTrue();
      expect(result.has('block')).toBeTrue();
    });

    test('should handle class names with numbers', async () => {
      const cssContent = `
        .button1 { color: blue; }
        .button2 { color: red; }
        .v2-button { color: green; }
      `;
      const filePath = path.join(tempDir, 'numbers.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button1')).toBeTrue();
      expect(result.has('button2')).toBeTrue();
      expect(result.has('v2-button')).toBeTrue();
    });

    test('should extract id selectors as local identifiers', async () => {
      const cssContent = `
        #myId { color: blue; }
        .myClass { color: red; }
      `;
      const filePath = path.join(tempDir, 'id.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('myClass')).toBeTrue();
      // CSS Modules treats IDs as local identifiers too
      expect(result.has('myId')).toBeTrue();
    });

    test('should not extract element selectors', async () => {
      const cssContent = `
        div { color: blue; }
        .myClass { color: red; }
      `;
      const filePath = path.join(tempDir, 'element.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('myClass')).toBeTrue();
      expect(result.has('div')).toBeFalse();
    });
  });

  describe('imports', () => {
    test('should handle @import statements', async () => {
      const importedCss = '.imported { color: blue; }';
      const importedPath = path.join(tempDir, 'imported.css');
      await fs.writeFile(importedPath, importedCss);

      const mainCss = `
        @import './imported.css';
        .main { color: red; }
      `;
      const mainPath = path.join(tempDir, 'main.module.css');
      await fs.writeFile(mainPath, mainCss);

      const result = await extractClassnames(mainPath);

      expect(result.has('main')).toBeTrue();
      expect(result.has('imported')).toBeTrue();
    });

    test('should handle relative imports', async () => {
      const subDir = path.join(tempDir, 'styles');
      await fs.mkdir(subDir);

      const baseCss = '.base { color: blue; }';
      const basePath = path.join(subDir, 'base.css');
      await fs.writeFile(basePath, baseCss);

      const mainCss = `
        @import './styles/base.css';
        .component { color: red; }
      `;
      const mainPath = path.join(tempDir, 'component.module.css');
      await fs.writeFile(mainPath, mainCss);

      const result = await extractClassnames(mainPath);

      expect(result.has('component')).toBeTrue();
      expect(result.has('base')).toBeTrue();
    });
  });

  describe('error handling', () => {
    test('should reject when file does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.module.css');

      await expect(extractClassnames(nonExistentPath)).rejects.toThrow();
    });

    test('should reject when file is not readable', async () => {
      const filePath = path.join(tempDir, 'unreadable.module.css');
      await fs.writeFile(filePath, '.test { color: blue; }');
      await fs.chmod(filePath, 0o000);

      await expect(extractClassnames(filePath)).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(filePath, 0o644);
    });

    test('should reject on malformed CSS', async () => {
      const cssContent = '.button { color: blue; /* unclosed comment';
      const filePath = path.join(tempDir, 'malformed.module.css');
      await fs.writeFile(filePath, cssContent);

      // PostCSS will throw on unclosed comments
      await expect(extractClassnames(filePath)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle very long class names', async () => {
      const longClassName = 'a'.repeat(1000);
      const cssContent = `.${longClassName} { color: blue; }`;
      const filePath = path.join(tempDir, 'long.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has(longClassName)).toBeTrue();
    });

    test('should handle many class names', async () => {
      const classCount = 1000;
      const classes = Array.from({ length: classCount }, (_, i) => `.class${i} { color: blue; }`);
      const cssContent = classes.join('\n');
      const filePath = path.join(tempDir, 'many.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBe(classCount);
      expect(result.has('class0')).toBeTrue();
      expect(result.has(`class${classCount - 1}`)).toBeTrue();
    });

    test('should deduplicate class names', async () => {
      const cssContent = `
        .button { color: blue; }
        .button { background: red; }
        .button:hover { color: white; }
      `;
      const filePath = path.join(tempDir, 'duplicate.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBe(1);
      expect(result.has('button')).toBeTrue();
    });

    test('should handle unicode class names', async () => {
      const cssContent = '.café { color: brown; }';
      const filePath = path.join(tempDir, 'unicode.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('café')).toBeTrue();
    });

    test('should handle escaped characters in class names', async () => {
      const cssContent = '.my\\:class { color: blue; }';
      const filePath = path.join(tempDir, 'escaped.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.size).toBeGreaterThan(0);
    });

    test('should handle :export with comments', async () => {
      const cssContent = `
        .button { color: blue; }
        :export {
          /* This is a comment in export */
          button: button_abc123;
        }
      `;
      const filePath = path.join(tempDir, 'export-comment.module.css');
      await fs.writeFile(filePath, cssContent);

      const result = await extractClassnames(filePath);

      expect(result.has('button')).toBeTrue();
    });
  });
});
