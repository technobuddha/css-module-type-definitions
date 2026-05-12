import path from 'node:path';

import { type Uri } from 'vscode';

import { type Logger } from './logger.ts';
import { type Options } from './options.ts';

const reDefaultIsCss = /\.module\.(?:css|less|sass|scss|styl(?:us)?)$/v;
const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');
let reIsCss = reDefaultIsCss;

function toFilename(filename: string | Uri): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}

export function isRelative(filename: string | Uri): boolean {
  return reIsRelative.test(toFilename(filename));
}

export function isCSS(filename: string | Uri): boolean {
  return reIsCss.test(toFilename(filename));
}

export function isRelativeCSS(filename: string | Uri): boolean {
  return isRelative(filename) && isCSS(filename);
}

export function setCSSMatchers(options: Options, logger: Logger): void {
  const { cssModules } = options;
  if (cssModules) {
    const { filePattern } = cssModules;

    if (filePattern) {
      try {
        reIsCss = new RegExp(filePattern, 'v');
        return;
      } catch (e) {
        logger.error(e);
        // Use default is regexp is invalid
      }
    }
  }

  reIsCss = reDefaultIsCss;
}
