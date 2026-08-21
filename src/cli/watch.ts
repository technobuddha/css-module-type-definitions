import fs from 'node:fs/promises';
import path from 'node:path';

import { empty, noop } from '@technobuddha/library';
import chokidar from 'chokidar';

import { fileOperation, globIsCssModule } from '../common/index.ts';

import { generateTypes } from './generate-types.ts';
import { type Ignorer } from './ignorer.ts';
import { type Optionator } from './optionator.ts';
import { update } from './update.ts';

type UpdateOptions = {
  readonly root: string;
  readonly optionator: Optionator;
  readonly ignorer: Ignorer;
};

export async function watch({ root, optionator, ignorer }: UpdateOptions): Promise<void> {
  await update({ logger: optionator.logger, root, options: optionator.options, ignorer });
  return new Promise<void>(() => {
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
              ignorer.isIgnored(rPath) || !path.matchesGlob(path.basename(rPath), globIsCssModule())
            );
          }

          return false;
        },
      })
      .on('change', (file) => {
        void generateTypes(file, { options: optionator.options, root, logger: optionator.logger });
      })
      .on('add', (file) => {
        void generateTypes(file, { options: optionator.options, root, logger: optionator.logger });
      })
      .on('unlink', (file) => {
        const { dir, name, ext } = path.parse(file);

        const dts = path.join(dir, `${name}.d${ext}.ts`);

        void fs
          .rm(dts)
          .then(() => optionator.logger.info(fileOperation(dts, 'deleted')))
          .catch(noop);
      });

    optionator.onChange(() => {
      void update({ logger: optionator.logger, root, options: optionator.options, ignorer });
    });
  });
}
