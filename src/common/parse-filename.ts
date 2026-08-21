import path from 'node:path';

import {
  CODE_JS_EXTENSIONS,
  CODE_TS_EXTENSIONS,
  REACT_JS_EXTENSIONS,
  REACT_TS_EXTENSIONS,
} from './extensions.ts';

type DirNameAndExtension = {
  readonly dir: string;
  readonly name: string;
  readonly base: string;
  readonly ext: string;
  readonly root: string;
};

const tsExtensions = new Set([...CODE_TS_EXTENSIONS, ...REACT_TS_EXTENSIONS]);
const jsExtensions = new Set([...CODE_JS_EXTENSIONS, ...REACT_JS_EXTENSIONS]);

export function parseFilename(file: string): DirNameAndExtension {
  let { dir, name, base, ext, root } = path.parse(file);

  if (file.startsWith('.env')) {
    return { dir, name: '', base: '', ext: '.env', root };
  }

  const dots = name.split('.');
  if (tsExtensions.has(ext) && dots.length > 1 && dots.at(-1) === 'd') {
    ext = `.d${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (ext === '.ts' && dots.length > 2 && dots.at(-2) === 'd') {
    ext = '.d.*.ts';
    name = [...dots.slice(0, -2), dots.at(-1)].join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'test'
  ) {
    ext = `.test${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'test-d'
  ) {
    ext = `.test-d${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'spec'
  ) {
    ext = `.spec${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'spec-d'
  ) {
    ext = `.spec-d${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'config'
  ) {
    ext = `.config${ext}`;
    name = dots.slice(0, -1).join('.');
  } else if (
    (tsExtensions.has(ext) || jsExtensions.has(ext)) &&
    dots.length > 1 &&
    dots.at(-1) === 'setup'
  ) {
    ext = `.setup${ext}`;
    name = dots.slice(0, -1).join('.');
  }
  return { dir, name, base, ext, root };
}
