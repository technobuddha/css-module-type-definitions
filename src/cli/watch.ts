import fs from 'node:fs/promises';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import chokidar from 'chokidar';

import {
  fileOperation,
  generateTypes,
  type Ignorer,
  type Logger,
  type Options,
} from '../common/index.ts';

import { update } from './update.ts';

type UpdateOptions = {
  options: Options;
  logger: Logger;
  ignorer: Ignorer;
};

export async function watch(
  globIsCss: string,
  globIsTypeDefinition: string,
  { options, logger, ignorer }: UpdateOptions,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return new Promise<void>(async () => {
    await update(globIsCss, globIsTypeDefinition, { options, logger, ignorer });

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
            return ignorer.isIgnored(rPath) || !path.matchesGlob(path.basename(rPath), globIsCss);
          }
          return false;
        },
      })
      .on('change', (file) => {
        void generateTypes(file, { options, logger });
      })
      .on('add', (file) => {
        void generateTypes(file, { options, logger });
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
