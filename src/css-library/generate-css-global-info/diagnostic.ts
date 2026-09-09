import { type Range } from '../position.ts';

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  public range: Range;
  public message: string;
  public severity: DiagnosticSeverity;

  public constructor(range: Range, message: string, severity = DiagnosticSeverity.Warning) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}
