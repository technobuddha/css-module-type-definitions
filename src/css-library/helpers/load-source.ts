import fs from 'node:fs/promises';

import { Text } from './text.ts';

export async function loadSource(sources: Map<string, Text>, filename: string): Promise<Text> {
  let text = sources.get(filename);
  if (text) {
    return text;
  }

  text = new Text(await fs.readFile(filename, 'utf-8'));

  sources.set(filename, text);
  return text;
}
