import path from 'node:path';

import { unindent } from '@technobuddha/library';
import { type Rule } from 'postcss';

import { Location, type LocationAndSnippet, walkClasses } from '../helpers/index.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';

export async function extractLocationsOfClassName({
  root,
  directory,
  smc,
}: ExtractorArguments): Promise<Map<string, LocationAndSnippet[]>> {
  const locationsOfClassName: Map<string, LocationAndSnippet[]> = new Map();

  const rules: Rule[] = [];
  root.walkRules((rule) => {
    rules.push(rule);
  });

  for (const rule of rules) {
    const { source, position } = smc.node(rule);

    for (const { name, range } of walkClasses(rule.selector)) {
      const snippet = [
        `###### ${path.basename(source)}:${position.line + 1}`,
        '```css',
        unindent(rule.toString()),
        '```',
      ].join('\n');

      locationsOfClassName.getOrInsert(name, []).push({
        snippet,
        location: new Location(
          path.resolve(directory, source),
          position.add(range.start).add({ column: 1 }),
          position.add(range.end).add({ column: 1 }),
        ),
      });
    }
  }

  return locationsOfClassName;
}
