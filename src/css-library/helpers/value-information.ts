import path from 'node:path';

import { Diagnostic } from './diagnostic.ts';
import { DiagnosticSeverity } from './diagnostic-severity.ts';
import { type Location } from './location.ts';
import { type Range } from './range.ts';

export type UsageType =
  'prop' | 'attribute' | 'class' | 'id' | 'tag' | 'pseudo' | 'word' | 'function';

type Usage = {
  type: UsageType;
  range: Range;
  value: string;
};

type Import = { from: string; name: string };

export class ValueInformation {
  #value: string | undefined = undefined;
  readonly #name: string;
  readonly #location: Location[] = [];
  readonly #snippet: string[] = [];
  readonly #imports: Import[] = [];
  readonly #diagnostics: Diagnostic[] = [];
  readonly #usages: Usage[] = [];

  public constructor(name: string) {
    this.#name = name;
  }

  private overridden(location: Location, importName: string): void {
    if (this.isReady) {
      this.#diagnostics.push(
        new Diagnostic(
          location.range,
          `${importName} is already defined.`,
          DiagnosticSeverity.Error,
        ),
      );
    }
  }

  public get name(): string {
    return this.#name;
  }

  public get isReady(): boolean {
    return this.#value !== undefined;
  }

  public get value(): string {
    if (this.isReady) {
      return this.#value!;
    }
    throw new Error('not ready');
  }

  public get valueOrUndefined(): string | undefined {
    return this.#value;
  }

  public get location(): Location[] {
    return this.#location;
  }

  public get snippet(): string[] {
    return this.#snippet;
  }

  public get imports(): Import[] {
    return this.#imports;
  }

  public get usages(): Usage[] {
    return this.#usages;
  }

  public get diagnostics(): Diagnostic[] {
    return this.#diagnostics;
  }

  public define({
    value,
    snippet,
    location,
  }: {
    value: string;
    snippet: string;
    location: Location;
  }): void {
    this.overridden(location, this.#name);

    this.#value = value;
    this.#snippet.push(snippet);
    this.#location.push(location);
  }

  public import({
    parent,
    snippet,
    location,
    declaration,
    importedFrom,
    importName,
  }: {
    parent: ValueInformation | undefined;
    snippet: string;
    location: Location;
    declaration: Location;
    importedFrom: string;
    importName: string;
  }): void {
    if (parent) {
      this.overridden(location, importName);
      this.#value = parent.value;
      this.#snippet.push(...parent.snippet, snippet);
    } else {
      this.#snippet.push(snippet);
      this.#diagnostics.push(
        new Diagnostic(
          declaration.range,
          `import ${importName} not defined in ${path.basename(importedFrom)}`,
          DiagnosticSeverity.Error,
        ),
      );
    }

    this.#location.push(location);
    this.#imports.push({ from: importedFrom, name: importName });
  }

  public used(type: UsageType, range: Range, value: string): void {
    this.#usages.push({ type, range, value });
  }
}
