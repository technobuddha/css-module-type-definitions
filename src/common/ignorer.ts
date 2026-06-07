export interface Ignorer<T> {
  isIgnored(file: T): boolean;
  findUnignoredFiles(glob: string): Promise<T[]>;
}
