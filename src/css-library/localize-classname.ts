import { camelCase } from '@technobuddha/library';

import { type Options } from '../common/options.ts';

function dashCase(word: string): string {
  return word.replaceAll(/-+(\w)/gv, (_match: string, firstLetter: string) =>
    firstLetter.toUpperCase(),
  );
}

export function localizeClassname(classname: string, options: Options): string[] {
  const entries: string[] = [];

  switch (options.cssModules?.localsConvention) {
    case 'camelCase': {
      entries.push(classname);
      const transformedClass = camelCase(classname);
      if (transformedClass !== classname) {
        entries.push(transformedClass);
      }
      break;
    }
    case 'camelCaseOnly': {
      entries.push(camelCase(classname));
      break;
    }
    case 'dashes': {
      entries.push(classname);
      const transformedClass = dashCase(classname);
      if (transformedClass !== classname) {
        entries.push(transformedClass);
      }
      break;
    }
    case 'dashesOnly': {
      entries.push(dashCase(classname));
      break;
    }

    case undefined:
    default: {
      entries.push(classname);
      break;
    }
  }

  return entries;
}
