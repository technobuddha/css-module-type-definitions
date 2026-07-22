import { type Uri, workspace } from 'vscode';

export async function fileExists(file: Uri): Promise<boolean> {
  try {
    await workspace.fs.stat(file);
    return true;
  } catch {
    return false;
  }
}
