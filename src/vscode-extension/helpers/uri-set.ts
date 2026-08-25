import { Uri } from 'vscode';

export class ReadonlyUriSet {
  protected readonly set: Set<string> = new Set();

  public constructor(...inits: Iterable<Uri>[]) {
    this.set = new Set();

    for (const init of inits) {
      for (const uri of init) {
        this.set.add(uri.fsPath);
      }
    }
  }

  public has(uri: Uri): boolean {
    return this.set.has(uri.fsPath);
  }

  public some(predicate: (uri: Uri) => boolean): boolean {
    for (const value of this.set) {
      if (predicate(Uri.file(value))) {
        return true;
      }
    }
    return false;
  }

  public every(predicate: (uri: Uri) => boolean): boolean {
    for (const value of this.set) {
      if (!predicate(Uri.file(value))) {
        return false;
      }
    }
    return true;
  }

  public *map<T>(mapper: (uri: Uri) => T): Generator<T> {
    for (const value of this.set) {
      yield mapper(Uri.file(value));
    }
  }

  public *filter(predicate: (uri: Uri) => boolean): Generator<Uri> {
    for (const value of this.set) {
      const uri = Uri.file(value);
      if (predicate(uri)) {
        yield uri;
      }
    }
  }

  public get size(): number {
    return this.set.size;
  }

  public *values(): Generator<Uri> {
    for (const value of this.set) {
      yield Uri.file(value);
    }
  }

  public [Symbol.iterator](): Generator<Uri> {
    return this.values();
  }
}

export class UriSet extends ReadonlyUriSet {
  public add(uri: Uri): this {
    this.set.add(uri.fsPath);
    return this;
  }

  public addAll(uris: Iterable<Uri>): this {
    for (const uri of uris) {
      this.set.add(uri.fsPath);
    }
    return this;
  }

  public delete(uri: Uri): boolean {
    return this.set.delete(uri.fsPath);
  }

  public clear(): void {
    this.set.clear();
  }
}
