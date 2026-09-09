import path from 'node:path';

import { type AtRule } from 'postcss';

import { Location } from '../position.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';
import { loadSource } from './load-source.ts';
import { type LocationAndSnippet } from './location-and-snippet.ts';
import { mappedPosition } from './mapped-position.ts';
import { range } from './range.ts';

export async function extractLocationsOfKeyframe({
  root,
  directory,
  sources,
  smc,
}: ExtractorArguments): Promise<Map<string, LocationAndSnippet[]>> {
  const locationsOfKeyframe: Map<string, LocationAndSnippet[]> = new Map();

  const atRules: AtRule[] = [];
  root.walkAtRules('keyframes', (atRule) => {
    atRules.push(atRule);
  });

  for (const atRule of atRules) {
    let {
      source,
      position: { line, column },
    } = mappedPosition(atRule, smc);
    column += atRule.name.length + 1 + (atRule.raws.afterName?.length ?? 0);

    const snippet = await loadSource(sources, path.resolve(directory, source)).then((text) =>
      text.range(range(atRule)),
    );

    locationsOfKeyframe.getOrInsert(atRule.params, []).push({
      snippet,
      location: new Location(source, line, column, line, column + atRule.params.length),
    });
  }

  return locationsOfKeyframe;
}
