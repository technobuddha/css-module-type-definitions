import fs from 'node:fs/promises';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import chokidar from 'chokidar';

import {
  type FileIgnorer,
  fileOperation,
  generateTypes,
  type Logger,
  type Optionator,
} from './index.ts';
import { update } from './update.ts';

type UpdateOptions = {
  optionator: Optionator;
  logger: Logger;
  ignorer: FileIgnorer;
};

export async function watch({ optionator, logger, ignorer }: UpdateOptions): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return new Promise<void>(async () => {
    await update({ optionator, logger, ignorer });

    chokidar
      .watch(process.cwd(), {
        ignoreInitial: true,
        persistent: true,
        ignored: (file, stats) => {
          const rPath = path.relative(process.cwd(), file);

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
              !path.matchesGlob(path.basename(rPath), optionator.globIsCss)
            );
          }
          return false;
        },
      })
      .on('change', (file) => {
        void generateTypes(file, { options: optionator.options, logger });
      })
      .on('add', (file) => {
        void generateTypes(file, { options: optionator.options, logger });
      })
      .on('unlink', (file) => {
        const { dir, name, ext } = path.parse(file);

        const f1 = path.join(dir, `${name}.d${ext}.ts`);
        const f2 = path.join(dir, `${name}.d${ext}.ts.map`);

        fs.rm(f1)
          .then(() => logger.info(fileOperation(f1, 'deleted')))
          .catch(() => {});
        fs.rm(f2)
          .then(() => logger.info(fileOperation(f2, 'deleted')))
          .catch(() => {});
      });
  });
}
