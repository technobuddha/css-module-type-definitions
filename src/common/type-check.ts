import path from 'node:path';

import { type URI } from 'vscode-uri';

import { CSS_EXTENSIONS, MODULE_PATTERN } from './constants.ts';

function toPathname(filename: string | URI): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export function globIsCss(): string {
  return `*{${CSS_EXTENSIONS.map((ext) => ext.slice(1)).join(',')}}`;
}

export function globIsCssModule(): string {
  return `${MODULE_PATTERN}{${CSS_EXTENSIONS.map((ext) => ext.slice(1)).join(',')}}`;
}

export function isCss(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCss());
}

export function isCssModule(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCssModule());
}
