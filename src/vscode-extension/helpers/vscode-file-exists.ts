import { FileType, type Uri, workspace } from 'vscode';

export async function vscodeFileExists(file: Uri): Promise<boolean> {
  return workspace.fs.stat(file).then(
    (stat) => stat.type === FileType.File,
    () => false,
  );
}
