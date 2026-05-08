import path from 'node:path';

import { type Logger, type Options } from '../css-library/index.ts';

const reDefaultIsCss = /\.module\.(?:css|less|sass|scss|styl)$/v;
const reIsRelative = new RegExp(`^\\.{1,2}${path.sep}`, 'v');
let reIsCss = reDefaultIsCss;

export function isRelative(filename: string): boolean {
  return reIsRelative.test(filename);
}

export function isCSS(filename: string): boolean {
  return reIsCss.test(filename);
}

export function isRelativeCSS(filename: string): boolean {
  return isRelative(filename) && isCSS(filename);
}

export function setCSSMatchers(options: Options, logger: Logger): void {
  const { cssPattern: customMatcher } = options;
  if (customMatcher) {
    try {
      const customMatcherRegExp = new RegExp(customMatcher, 'v');
      reIsCss = customMatcherRegExp;
      return;
    } catch (e) {
      logger.error(e);
    }
  }

  reIsCss = reDefaultIsCss;
}
