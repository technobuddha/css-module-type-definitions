import fs from 'node:fs/promises';
import path from 'node:path';

import { empty } from '@technobuddha/library';
import chokidar from 'chokidar';
import { type Ignore } from 'ignore';

import { fileOperation, generateTypes, type Logger, type Options } from '../common/index.ts';

import { update } from './update.ts';

type UpdateOptions = {
  options: Options;
  logger: Logger;
  ig: Ignore;
};

export async function watch(
  globIsCss: string,
  globIsTypeDefinition: string,
  { options, logger, ig }: UpdateOptions,
): Promise<void> {
  await update(globIsCss, globIsTypeDefinition, { options, logger, ig });

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
          return ig.ignores(slashed);
        }
        if (stats?.isFile()) {
          return ig.ignores(rPath) || !path.matchesGlob(path.basename(rPath), globIsCss);
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
}
