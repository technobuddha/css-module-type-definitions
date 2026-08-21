import { type Options } from '../../common/index.ts';

import { type RawSourceMap } from '../source-map.ts';

type AdditionalData = NonNullable<
  Options['css']['preprocessor']['less' | 'sass' | 'scss']
>['additionalData'];

type GetSourceArguments = {
  readonly source: string;
  readonly filename: string;
  readonly additionalData: AdditionalData;
};

type GetSourceReturn = {
  readonly content: string;
  readonly map?: RawSourceMap;
};

export async function getSource({
  source,
  filename,
  additionalData,
}: GetSourceArguments): Promise<GetSourceReturn> {
  if (additionalData) {
    if (typeof additionalData === 'function') {
      const content = await additionalData(source, filename);
      if (typeof content === 'string') {
        return { content };
      }

      if (content.map) {
        return {
          content: content.content,
          map: {
            file: filename,
            version: (content.map.version ?? 3).toString(),
            sources: (content.map.sources ?? []).filter((s) => s != null),
            names: content.map.names ?? [],
            sourcesContent: (content.map.sourcesContent ?? []).filter((s) => s != null),
            mappings: content.map.mappings,
          },
        };
      }

      return { content: content.content };
    }

    return { content: additionalData + source };
  }

  return { content: source };
}
