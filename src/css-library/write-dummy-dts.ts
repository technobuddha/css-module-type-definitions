import path from 'node:path';

import { type Logger, type Options } from '../common/index.ts';
import { writeIfDifferent } from '../common/write-if-dirrerent.ts';

import { dtsBottom } from './dts-bottom.ts';
import { dtsInfo } from './dts-info.ts';
import { dtsMiddle } from './dts-middle.ts';
import { dtsTop } from './dts-top.ts';

type CreateDummyDtsArguments = {
  file: string;
  options: Options;
  logger: Logger;
};

export async function writeDummyDts({
  file,
  options,
  logger,
}: CreateDummyDtsArguments): Promise<void> {
  const { dir, name, ext } = path.parse(file);
  const dtsFilename = `${dir}/${name}.d${ext}.ts`;

  const info = dtsInfo(file, options);
  const content = [...dtsTop(info), ...dtsMiddle(info), ...dtsBottom(info)].join('\n');

  return writeIfDifferent({
    file: dtsFilename,
    content,
    logger,
  });
}
