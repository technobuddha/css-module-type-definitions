import { dynamicImport } from '@technobuddha/library';

export async function reImport<T = unknown>(file: string): Promise<T> {
  const importFile = `${file}?v=${Date.now()}`;

  return dynamicImport<T>(importFile);
}
