import path from 'node:path';

import { empty } from '@technobuddha/library';
import less from 'less';

import { type Options } from '../../common/index.ts';
import { type Logger } from '../../common/logger.ts';

import { getSource } from './get-source.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformLessArguments = {
  filename: string;
  directory: string;
  options: Options;
  logger: Logger;
};

export async function transformLess(
  source: string,
  { filename, directory, options }: TransformLessArguments,
): Promise<TransformerReturn> {
  const additionalData = options.preprocessor?.less?.additionalData;
  // TODO sourceMap with additionalData

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    less
      .render(content, {
        filename: path.basename(filename),
        paths: [directory],
        sourceMap: {},
        ...options,
      })
      .catch((error: Less.RenderError) => {
        throw new Error(error.message);
      })
      .then(({ css, map }) => ({
        css: css.replace(/\/\*# sourceMapping.*$/mv, empty),
        sourceMap: map ? JSON.parse(map) : undefined,
      })),
  );
}
