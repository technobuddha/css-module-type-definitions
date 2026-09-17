import path from 'node:path';

import { empty } from '@technobuddha/library';

import { Diagnostic } from './diagnostic.ts';
import { DiagnosticSeverity } from './diagnostic-severity.ts';
import { Location } from './location.ts';
import { type Range } from './range.ts';

export type UsageType =
  'prop' | 'attribute' | 'class' | 'id' | 'tag' | 'pseudo' | 'word' | 'function';

type Usage = {
  type: UsageType;
  range: Range;
  value: string;
};

type Import = { from: string; name: string };

type LocationAndSnippet = {
  location: Location;
  snippet: string;
};

export class ValueInformation {
  #value: string | undefined = undefined;
  #definition: Location = new Location(empty, 0, 0, 0, 0);
  readonly #name: string;
  readonly #locationAndSnippet: LocationAndSnippet[] = [];
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

  public get locationAndSnippet(): LocationAndSnippet[] {
    return this.#locationAndSnippet;
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

  public get definition(): Location {
    return this.#definition;
  }

  public define({
    value,
    snippet,
    location,
    definition,
  }: {
    value: string;
    snippet: string;
    location: Location;
    definition: Location;
  }): void {
    this.overridden(location, this.#name);

    this.#value = value;
    this.#locationAndSnippet.push({ location, snippet });
    this.#definition = definition;
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
    } else {
      this.#diagnostics.push(
        new Diagnostic(
          declaration.range,
          `import ${importName} not defined in ${path.basename(importedFrom)}`,
          DiagnosticSeverity.Error,
        ),
      );
    }

    this.#locationAndSnippet.push({ location, snippet });
    this.#imports.push({ from: importedFrom, name: importName });
  }

  public used(type: UsageType, range: Range, value: string): void {
    this.#usages.push({ type, range, value });
  }
}
