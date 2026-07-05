import fs from 'node:fs/promises';
import path from 'node:path';

import { empty, noop } from '@technobuddha/library';
import chokidar from 'chokidar';

import { type FileIgnorer, fileOperation, generateTypes, type Optionator } from './index.ts';
import { update } from './update.ts';

type UpdateOptions = {
  root: string;
  optionator: Optionator;
  ignorer: FileIgnorer;
};

export async function watch({ root, optionator, ignorer }: UpdateOptions): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return new Promise<void>(async () => {
    await update({ optionator, ignorer });

    chokidar
      .watch(root, {
        ignoreInitial: true,
        persistent: true,
        atomic: true,
        ignored: (file, stats) => {
          const rPath = path.relative(root, file);

          if (rPath === empty) {
            return false;
          }

          if (stats?.isDirectory()) {
            const slashed = rPath.endsWith(path.sep) ? rPath : `${rPath}${path.sep}`;
            return ignorer.isIgnored(slashed);
          }

          if (stats?.isFile()) {
            return (
              ignorer.isIgnored(rPath) ||
              !path.matchesGlob(path.basename(rPath), optionator.globIsCssModule)
            );
          }

          return false;
        },
      })
      .on('change', (file) => {
        void generateTypes(file, { options: optionator.options, logger: optionator.logger });
      })
      .on('add', (file) => {
        void generateTypes(file, { options: optionator.options, logger: optionator.logger });
      })
      .on('unlink', (file) => {
        const { dir, name, ext } = path.parse(file);

        const f1 = path.join(dir, `${name}.d${ext}.ts`);
        const f2 = path.join(dir, `${name}.d${ext}.ts.map`);

        fs.rm(f1)
          .then(() => optionator.logger.info(fileOperation(f1, 'deleted')))
          .catch(noop);
        fs.rm(f2)
          .then(() => optionator.logger.info(fileOperation(f2, 'deleted')))
          .catch(noop);
      });

    optionator.onChange(() => {
      void update({ optionator, ignorer });
    });
  });
}
