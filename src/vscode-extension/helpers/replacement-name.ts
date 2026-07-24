import { camelCase, isJsIdentifier, kebabCase, quote } from '@technobuddha/library';

import { type NormalizedOptions } from '../../common/index.ts';
import { dashes } from '../../css-library/index.ts';

export function replacementName(
  newName: string,
  options: NormalizedOptions,
): { codeName: string; cssName: string } {
  let cssName = newName;
  switch (options.css.classesConvention) {
    case 'kebabCase': {
      cssName = kebabCase(newName);
      break;
    }

    case 'none':
    default: {
      break;
    }
  }

  let codeName: string;
  switch (options.css.modules.localsConvention) {
    case 'all':
    case 'camelCase': {
      codeName = camelCase(newName);
      codeName = isJsIdentifier(codeName) ? `.${codeName}` : `[${quote(cssName)}]`;
      break;
    }

    case 'camelCaseOnly': {
      codeName = camelCase(newName);
      codeName = isJsIdentifier(codeName) ? `.${codeName}` : `[${quote(codeName)}]`;
      break;
    }

    case 'dashes': {
      codeName = dashes(newName);
      codeName = isJsIdentifier(codeName) ? `.${codeName}` : `[${quote(cssName)}]`;
      break;
    }

    case 'dashesOnly': {
      codeName = dashes(newName);
      codeName = isJsIdentifier(codeName) ? `.${codeName}` : `[${quote(codeName)}]`;
      break;
    }

    case 'none':
    case undefined:
    default: {
      codeName = cssName;
      codeName = isJsIdentifier(codeName) ? `.${codeName}` : `[${quote(cssName)}]`;
      break;
    }
  }

  return { cssName, codeName };
}
