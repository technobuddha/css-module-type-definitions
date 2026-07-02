import { empty } from '@technobuddha/library';
import MagicString from 'magic-string';
import { type RawSourceMap } from 'source-map-js';

import { type Options } from '../../common/index.ts';

type AdditionalData = NonNullable<NonNullable<Options['preprocessor']>['less']>['additionalData'];

type GetSourceArguments = {
  source: string;
  filename: string;
  additionalData: AdditionalData;
  sourceMap?: boolean;
  sep?: string;
};

type GetSourceReturn = {
  content: string;
  map?: RawSourceMap;
};

export async function getSource({
  source,
  filename,
  additionalData,
  sourceMap = false,
  sep = empty,
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

    if (sourceMap) {
      const ms = new MagicString(source);
      ms.appendLeft(0, sep);
      ms.appendLeft(0, additionalData);

      const magicMap = ms.generateMap({ hires: 'boundary' });

      const map: RawSourceMap = {
        file: filename,
        version: magicMap.version.toString(),
        sources: [filename],
        names: magicMap.names,
        sourcesContent: magicMap.sourcesContent,
        mappings: magicMap.mappings,
      };

      return {
        content: ms.toString(),
        map,
      };
    }

    return { content: additionalData + sep + source };
  }

  return { content: source };
}
