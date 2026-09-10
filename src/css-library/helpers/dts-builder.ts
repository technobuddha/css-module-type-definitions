import path from 'node:path';

import {
  camelCase,
  empty,
  encodeBase64,
  isJsVariable,
  pascalCase,
  quote,
  space,
  splitLines,
} from '@technobuddha/library';

import { type Logger, type Options } from '../../common/index.ts';

import { Position } from './position.ts';
import { SourceMapGenerator } from './source-map.ts';

export class DtsBuilder {
  readonly #dts: string[];
  readonly #variable: string;
  readonly #classname: string;
  readonly #smg: SourceMapGenerator;
  readonly #options: Options;

  public constructor(file: string, dtsFilename: string, options: Options, logger: Logger) {
    this.#options = options;
    this.#smg = new SourceMapGenerator({ file: dtsFilename, logger });

    const { name, ext } = path.parse(file);
    let variable = camelCase(name.replace(/\.module$/v, empty));
    let classname = pascalCase(variable);
    if (!isJsVariable(variable)) {
      variable = camelCase(ext.replace(/^\./v, empty));
      classname = pascalCase(variable);
    }

    this.#variable = variable;
    this.#classname = classname;
    this.#dts = [...splitLines(options.css.dtsHeader), `type ${classname} = {`];
  }

  public add(source: string, original: Position, localName: string, scopeName: string): this {
    this.#smg.addMapping({
      source,
      // 11 = length of {space.repeat(2)}readonly{space}{quote},
      generated: new Position(this.#dts.length, 11),
      original,
    });

    this.#dts.push(
      `${space.repeat(2)}readonly${space}${quote(localName)}:${space}${quote(scopeName)};`,
    );
    return this;
  }

  public finalize(): string {
    this.#dts.push(
      '};',
      empty,
      `declare const ${this.#variable}: ${this.#classname};`,
      empty,
      `export default ${this.#variable};`,
      empty,
      `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodeBase64(JSON.stringify(this.#smg.sourceMap()), 'utf-8')}`,
      ...(this.#options.css.dtsFooter ?
        [empty, ...splitLines(this.#options.css.dtsFooter), empty]
      : [empty]),
    );
    return this.#dts.join('\n');
  }
}
