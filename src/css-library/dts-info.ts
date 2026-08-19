import path from 'node:path';

import { camelCase, empty, isJsVariable, pascalCase } from '@technobuddha/library';

import { type Options } from '../common/index.ts';

export type DtsInfo = { variable: string; classname: string; options: Options };

export function dtsInfo(file: string, options: Options): DtsInfo {
  const parsed = path.parse(file);
  let variable = camelCase(parsed.name.replace(/\.module$/v, empty));
  let classname = pascalCase(variable);
  if (!isJsVariable(variable)) {
    variable = camelCase(parsed.ext.replace(/^\./v, empty));
    classname = pascalCase(variable);
  }
  return { variable, classname, options };
}
