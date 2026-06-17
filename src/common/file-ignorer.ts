import fs from 'node:fs/promises';
import path from 'node:path';

import { isWithinDirectory, noop, pathDepth } from '@technobuddha/library';
import { type FSWatcher } from 'chokidar';
import { glob } from 'glob';
import ignore, { type Ignore } from 'ignore';

import { fileOperation } from './file-operation.ts';
import { Ignorer } from './ignorer.ts';
import { type Logger } from './logger.ts';

type FileIgnorerOptions = {
  root: string;
  logger: Logger;
  watch: boolean;
};

export class FileIgnorer extends Ignorer<string> implements AsyncDisposable {
  protected readonly ignores: Map<string, Ignore> = new Map();
  protected readonly ignoreWatcher: FSWatcher | undefined;

  public static async create({ root, logger, watch }: FileIgnorerOptions): Promise<FileIgnorer> {
    const ignorer = new FileIgnorer({ root, logger, watch });

    await Ignorer.init(ignorer);
    await ignorer.scanIgnores();

    return ignorer;
  }

  protected constructor({ root, logger, watch }: FileIgnorerOptions) {
    super({ root, logger, watch });
  }

  protected async loadIgnore(file: string): Promise<void> {
    return fs
      .readFile(file, 'utf-8')
      .then((content) => {
        this.ignores.set(path.dirname(file), ignore().add(content));
      })
      .catch(noop);
  }

  protected async scanIgnores(): Promise<void> {
    this.ignores.clear();

    for (const file of await glob('**/.gitignore', { cwd: this.root, dot: true })) {
      // TODO possible check if this file is ignored by parent .gitignore files?
      await this.loadIgnore(file);
      this.logger.debug(fileOperation(file, 'configuration'));
    }
  }

  public toFilename(file: string): string {
    return file;
  }

  public isIgnored(file: string): boolean {
    const name = path.relative(this.root, file);

    return [
      ...Array.from(this.ignores.entries().filter(([dir]) => isWithinDirectory(dir, name)))
        .sort(([a], [b]) => pathDepth(a) - pathDepth(b))
        .map(([_, ig]) => ig),
    ]
      .reduce((main, ig) => main.add(ig), this.ignorable())
      .ignores(name);
  }

  public async findUnignoredFiles(pattern: string): Promise<string[]> {
    const result: string[] = [];

    for (const file of await glob(pattern, { cwd: this.root, dot: true })) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }

  public override async [Symbol.asyncDispose](): Promise<void> {
    await super[Symbol.asyncDispose]();
    await this.ignoreWatcher?.close();
  }
}
