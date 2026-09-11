import { DiagnosticSeverity } from './diagnostic-severity.ts';
import { type Range } from './range.ts';

export class Diagnostic {
  public readonly range: Range;
  public readonly message: string;
  public readonly severity: DiagnosticSeverity;
  public readonly source = 'cmtd';

  public constructor(range: Range, message: string, severity = DiagnosticSeverity.Warning) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}
