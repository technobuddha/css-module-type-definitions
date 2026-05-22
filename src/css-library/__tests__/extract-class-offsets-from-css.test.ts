import { extractClassOffsetsFromCss } from '../extract-class-offsets-from-css.ts';

describe('extractClassOffsetsFromCss', () => {
  test('extracts class selectors and keeps first duplicate occurrence', () => {
    const css = [
      '.first { color: red; }',
      '.first { color: blue; }',
      '.second { color: green; }',
    ].join('\n');

    const offsets = extractClassOffsetsFromCss(css, { filename: 'styles.module.css' });

    expect(Array.from(offsets.keys())).toIncludeSameMembers(['first', 'second']);
    expect(offsets.get('first')).toEqual({ line: 1, column: 1 });
    expect(offsets.get('second')).toEqual({ line: 3, column: 1 });
  });

  test('extracts @value variable declarations', () => {
    const css = '@value token-name: #fff;';

    const offsets = extractClassOffsetsFromCss(css, { filename: 'styles.module.css' });

    expect(offsets.get('token-name')).toEqual({ line: 1, column: 8 });
  });

  test('extracts @value import aliases and imported names', () => {
    const css = '@value colorPrimary as primary, accent from "./palette.css";';

    const offsets = extractClassOffsetsFromCss(css, { filename: 'styles.module.css' });

    expect(Array.from(offsets.keys())).toIncludeSameMembers(['primary', ' accent']);
    expect(offsets.get('primary')).toBeDefined();
    expect(offsets.get(' accent')).toBeDefined();
  });

  test('extracts @keyframes names', () => {
    const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';

    const offsets = extractClassOffsetsFromCss(css, { filename: 'styles.module.css' });

    expect(offsets.get('fadeIn')).toEqual({ line: 1, column: 12 });
  });

  test('logs unsupported @value rules', () => {
    const errors: unknown[] = [];
    const logger = {
      log: (_message: string) => {},
      error: (error: unknown) => void errors.push(error),
    };

    extractClassOffsetsFromCss('@value nonsense input;', {
      filename: 'styles.module.css',
      logger,
    });

    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('Unsupported "@value" rule input');
  });
});
