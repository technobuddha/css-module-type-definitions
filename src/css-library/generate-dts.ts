import fs from 'node:fs/promises';

import { generateTypesFromCss } from './generate-types-from-css.ts';

export async function generateDts(file: string): Promise<void> {
  const { dts, map } = await generateTypesFromCss(file);

  const dtsFile = `${file}.d.ts`;
  const mapFile = `${file}.map`;
  await fs.writeFile(dtsFile, dts, 'utf-8');
  await fs.writeFile(mapFile, JSON.stringify(map), 'utf-8');
}
