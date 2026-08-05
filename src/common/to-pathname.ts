import { type URI } from 'vscode-uri';

export function toPathname(filename: string | URI): string {
  return typeof filename === 'string' ? filename : filename.fsPath;
}
