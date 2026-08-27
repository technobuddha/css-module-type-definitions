import { type DocumentSelector } from 'vscode';

import { CODE_EXTENSIONS, CSS_EXTENSIONS } from '../common/index.ts';

export const codeSelector: DocumentSelector = { pattern: `**/*{${CODE_EXTENSIONS.join(',')}}` };
export const cssSelector: DocumentSelector = { pattern: `**/*{${CSS_EXTENSIONS.join(',')}}` };
