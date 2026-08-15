export const CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'];

export const CODE_TS_EXTENSIONS = ['.ts', '.mts', '.cts'];
export const CODE_JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];

export const REACT_TS_EXTENSIONS = ['.tsx', '.mtsx', '.ctsx'];
export const REACT_JS_EXTENSIONS = ['.jsx', '.mjsx', '.cjsx'];

export const TEST_TS_EXTENSIONS = [
  '.test.ts',
  '.test.mts',
  '.test.cts',
  '.spec.ts',
  '.spec.mts',
  '.spec.cts',
];
export const TEST_JS_EXTENSIONS = [
  '.test.js',
  '.test.mjs',
  '.test.cjs',
  '.spec.js',
  '.spec.mjs',
  '.spec.cjs',
];

export const TYPECHECK_EXTENSIONS = [
  '.test-d.ts',
  '.test-d.mts',
  '.test-d.cts',
  '.spec-d.ts',
  '.spec-d.mts',
  '.spec-d.cts',
];

export const CODE_EXTENSIONS = [
  ...CODE_JS_EXTENSIONS,
  ...CODE_TS_EXTENSIONS,
  ...REACT_JS_EXTENSIONS,
  ...REACT_TS_EXTENSIONS,
];

export const TEST_EXTENSIONS = [...TEST_JS_EXTENSIONS, ...TEST_TS_EXTENSIONS];

export const CSS_EXTENSIONS = ['.css', '.less', '.sass', '.scss'];
// TODO , '.styl', '.stylus'];

export const MODULE_PATTERN = '*.module' as const;
