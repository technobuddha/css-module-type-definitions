import { Uri } from 'vscode';

export class ReadonlyUriMap<T> {
  protected readonly map: Map<string, T> = new Map();

  public constructor(init?: Iterable<[Uri, T]>) {
    this.map = new Map();

    if (init) {
      for (const [uri, value] of init) {
        this.map.set(uri.fsPath, value);
      }
    }
  }

  public get(uri: Uri): T | undefined {
    return this.map.get(uri.fsPath);
  }

  public *values(): Generator<T> {
    for (const value of this.map.values()) {
      yield value;
    }
  }

  public *keys(): Generator<Uri> {
    for (const key of this.map.keys()) {
      yield Uri.file(key);
    }
  }

  public *entries(): Generator<[Uri, T]> {
    for (const [key, value] of this.map) {
      yield [Uri.file(key), value];
    }
  }

  public has(uri: Uri): boolean {
    return this.map.has(uri.fsPath);
  }

  public [Symbol.iterator](): Generator<[Uri, T]> {
    return this.entries();
  }
}

export class UriMap<T> extends ReadonlyUriMap<T> {
  public set(uri: Uri, value: T): void {
    this.map.set(uri.fsPath, value);
  }

  public delete(uri: Uri): boolean {
    return this.map.delete(uri.fsPath);
  }

  public getOrInsert(uri: Uri, value: T): T {
    return this.map.getOrInsert(uri.fsPath, value);
  }

  public getOrInsertComputed(uri: Uri, compute: () => T): T {
    return this.map.getOrInsertComputed(uri.fsPath, compute);
  }

  public clear(): void {
    this.map.clear();
  }
}
