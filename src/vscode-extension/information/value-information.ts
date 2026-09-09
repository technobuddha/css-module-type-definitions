import { type Diagnostic, type Location, type Range } from 'vscode';

import {
  type UsageType,
  type ValueInformation as CssValueInformation,
} from '../../css-library/index.ts';

import { toDiagnostic, toLocation, toRange } from '../helpers/position.ts';

type Import = { from: string; name: string };
type Usage = { type: UsageType; range: Range };

export class ValueInformation {
  readonly #name: string;
  readonly #value: string;
  readonly #location: Location[];
  readonly #snippet: string[];
  readonly #imports: Import[];
  readonly #usages: Usage[];
  readonly #diagnostics: Diagnostic[];

  public constructor(vi: CssValueInformation) {
    this.#name = vi.name;
    this.#value = vi.value;
    this.#location = vi.location.map(toLocation);
    this.#snippet = vi.snippet;
    this.#imports = vi.imports;
    this.#usages = vi.usages.map((u) => ({ type: u.type, range: toRange(u.range) }));
    this.#diagnostics = vi.diagnostics.map(toDiagnostic);
  }

  public get name(): string {
    return this.#name;
  }

  public get value(): string {
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
}
