import { Diagnostic } from 'vscode';

import { type Diagnostic as CssDiagnostic } from '../../css-library/index.ts';

import { toRange } from './to-range.ts';

export function toDiagnostic(diagnostic: CssDiagnostic): Diagnostic {
  const diag = new Diagnostic(toRange(diagnostic.range), diagnostic.message, diagnostic.severity);
  diag.source = diagnostic.source;
  return diag;
}
