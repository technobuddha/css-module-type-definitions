import { type SeverityLevel } from '../../common/index.ts';

import { DiagnosticSeverity } from './diagnostic-severity.ts';

export function toDiagnosticSeverity(level: SeverityLevel): DiagnosticSeverity | undefined {
  switch (level) {
    case 'error': {
      return DiagnosticSeverity.Error;
    }
    case 'warning': {
      return DiagnosticSeverity.Warning;
    }
    case 'information': {
      return DiagnosticSeverity.Information;
    }

    case 'none':
    default: {
      return undefined;
    }
  }
}
