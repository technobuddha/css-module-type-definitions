import path from 'node:path';

import { URI } from 'vscode-uri';

import {
  CODE_EXTENSIONS,
  CSS_EXTENSIONS,
  MODULE_PATTERN,
  TEST_EXTENSIONS,
  TYPECHECK_EXTENSIONS,
} from './constants.ts';
import { parseFilename } from './parse-filename.ts';
import { toPathname } from './to-pathname.ts';

export function globIsCss(): string {
  return `*{${CSS_EXTENSIONS.join(',')}}`;
}

export function globIsCssModule(): string {
  return `${MODULE_PATTERN}{${CSS_EXTENSIONS.join(',')}}`;
}

export function globIsCssTypeDefinition(): string {
  return `${MODULE_PATTERN}{${CSS_EXTENSIONS.map((ext) => `.d${ext},${ext}.d.ts`).join(',')}}{.ts,.ts.map}`;
}

export function isCss(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCss());
}

export function isCssModule(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCssModule());
}

export function isCode(uri: string | URI): boolean {
  const { ext } = parseFilename(toPathname(uri));

  return CODE_EXTENSIONS.includes(ext);
}

export function globIsCode(): string {
  return `*{${CODE_EXTENSIONS.join(',')}}`;
}

export function isDts(filename: string | URI): boolean {
  const { ext } = parseFilename(toPathname(filename));

  return ext === '.d.ts' || ext === '.d.*.ts';
}

export function correspondingDts(filename: string): string | undefined;
export function correspondingDts(filename: URI): URI | undefined;
export function correspondingDts(filename: string | URI): string | URI | undefined {
  const file = toPathname(filename);
  const { ext, root, dir, name } = parseFilename(file);

  const dtsPath =
    (
      CODE_EXTENSIONS.includes(ext) ||
      TEST_EXTENSIONS.includes(ext) ||
      TYPECHECK_EXTENSIONS.includes(ext)
    ) ?
      path.format({ root, dir, name, ext: `.d${ext.replaceAll('js', 'ts')}` })
    : ext === '.dts' || ext === '.d.*.ts' ? file
    : path.format({ root, dir, name, ext: `.d${ext}.ts` });

  return typeof filename === 'string' ? dtsPath : URI.file(dtsPath);
}

export function correspondingSource(filename: string): string | undefined;
export function correspondingSource(filename: URI): URI | undefined;
export function correspondingSource(filename: string | URI): string | URI | undefined {
  const file = toPathname(filename);
  const { ext, root, dir, name } = parseFilename(file);

  const sourcePath = ext === '.d.ts' || ext === '.d.*.ts' ? path.format({ root, dir, name }) : file;

  return typeof filename === 'string' ? sourcePath : URI.file(sourcePath);
}
