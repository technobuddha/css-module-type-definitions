import path from 'node:path';

import { type URI } from 'vscode-uri';

import { CSS_EXTENSIONS, MODULE_PATTERN } from './constants.ts';

function toPathname(filename: string | URI): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export function globIsCss(): string {
  return `*{${CSS_EXTENSIONS.join(',')}}`;
}

export function globIsCssModule(): string {
  return `${MODULE_PATTERN}{${CSS_EXTENSIONS.join(',')}}`;
}

export function globIsTypeDefinition(): string {
  return `${MODULE_PATTERN}{${CSS_EXTENSIONS.map((ext) => `d.${ext},${ext}.d.ts`).join(',')}}{.ts,.ts.map}`;
}

export function isCss(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCss());
}

export function isCssModule(filename: string | URI): boolean {
  return path.matchesGlob(path.basename(toPathname(filename)), globIsCssModule());
}
