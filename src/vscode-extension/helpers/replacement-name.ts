import { camelCase, isJsIdentifier, kebabCase, quote } from '@technobuddha/library';

import { type NormalizedOptions } from '../../common/index.ts';
import { dashes } from '../../css-library/index.ts';

export function replacementName(
  newName: string,
  options: NormalizedOptions,
): { codeReplacement: string; cssReplacement: string } {
  let cssReplacement = newName;
  switch (options.css.classesConvention) {
    case 'kebabCase': {
      cssReplacement = kebabCase(newName);
      break;
    }

    case 'none':
    default: {
      break;
    }
  }

  let codeReplacement: string;
  switch (options.css.modules.localsConvention) {
    case 'all':
    case 'camelCase': {
      codeReplacement = camelCase(newName);
      codeReplacement =
        isJsIdentifier(codeReplacement) ? `.${codeReplacement}` : `[${quote(cssReplacement)}]`;
      break;
    }

    case 'camelCaseOnly': {
      codeReplacement = camelCase(newName);
      codeReplacement =
        isJsIdentifier(codeReplacement) ? `.${codeReplacement}` : `[${quote(codeReplacement)}]`;
      break;
    }

    case 'dashes': {
      codeReplacement = dashes(newName);
      codeReplacement =
        isJsIdentifier(codeReplacement) ? `.${codeReplacement}` : `[${quote(cssReplacement)}]`;
      break;
    }

    case 'dashesOnly': {
      codeReplacement = dashes(newName);
      codeReplacement =
        isJsIdentifier(codeReplacement) ? `.${codeReplacement}` : `[${quote(codeReplacement)}]`;
      break;
    }

    case 'none':
    case undefined:
    default: {
      codeReplacement = cssReplacement;
      codeReplacement =
        isJsIdentifier(codeReplacement) ? `.${codeReplacement}` : `[${quote(cssReplacement)}]`;
      break;
    }
  }

  return { cssReplacement, codeReplacement };
}
