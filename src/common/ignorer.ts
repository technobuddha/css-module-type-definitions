import fs from 'node:fs';
import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { globSync } from 'glob';
import ignore, { type Ignore } from 'ignore';

import { type Logger } from './logger.ts';

type IgnorerOptions = {
  logger?: Logger;
  watch?: boolean;
};

export class Ignorer implements AsyncDisposable {
  public dir: string;
  public logger: Logger;
  public ignores: Map<string, Ignore> = new Map();
  private watcher: FSWatcher | undefined;

  public constructor(dir: string, { logger = console, watch = true }: IgnorerOptions = {}) {
    // super();
    this.dir = path.resolve(dir);
    this.logger = logger;

    if (watch) {
      this.watcher = chokidar.watch(this.dir, {
        ignored: (file, stats) =>
          (stats?.isFile() ?? false) && path.basename(file) !== '.gitignore',
        ignoreInitial: true,
        persistent: true,
      });

      this.watcher.on('add', (f) => this.add(f));
      this.watcher.on('change', (f) => this.add(f));
      this.watcher.on('unlink', (f) => this.del(f));
    }

    for (const file of globSync('**/.gitignore', { cwd: this.dir, dot: true })) {
      this.add(file);
    }
  }

  private add(file: string): void {
    this.logger.debug(`+ignore: ${file}`);
    const dirname = path.dirname(path.relative(this.dir, file));

    try {
      const content = fs.readFileSync(file, 'utf-8');
      this.ignores.set(dirname, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error));
    }
  }

  private del(file: string): void {
    this.logger.debug(`-ignore: ${file}`);
    const dirname = path.dirname(path.relative(this.dir, file));
    this.ignores.delete(dirname);
  }

  public isIgnored(file: string): boolean {
    const name = path.relative(this.dir, file);

    const ignored = Array.from(
      this.ignores.entries().filter(([dir]) => isWithinDirectory(dir, name)),
    )
      .sort(([a], [b]) => pathDepth(a) - pathDepth(b))
      .reduce((main, [_, ig]) => main.add(ig), ignore());
    return ignored.ignores(name);
  }

  public async findUnignoredFiles(glob: string): Promise<string[]> {
    const result: string[] = [];

    for (const file of globSync(glob, { cwd: this.dir, dot: true })) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }
}
