import { empty } from '@technobuddha/library';
import { Uri, workspace } from 'vscode';

import { Text } from '../../css-library/index.ts';

export async function loadSource(filename: string): Promise<Text> {
  try {
    return new Text((await workspace.openTextDocument(Uri.file(filename))).getText());
  } catch {
    return new Text(empty);
  }
}
