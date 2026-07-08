import { ScriptKind } from 'typescript';

export function scriptKind(ext: string): ScriptKind {
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs': {
      return ScriptKind.JS;
    }

    case '.ts':
    case '.mts':
    case '.cts': {
      return ScriptKind.TS;
    }

    case '.jsx': {
      return ScriptKind.JSX;
    }

    case '.tsx': {
      return ScriptKind.TSX;
    }

    default: {
      return ScriptKind.Unknown;
    }
  }
}
