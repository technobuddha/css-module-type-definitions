import path from 'node:path';

import { empty } from '@technobuddha/library';
import { type AtRule } from 'postcss';

import {
  Diagnostic,
  DiagnosticSeverity,
  type Export,
  loadSource,
  Location,
  Range,
} from '../helpers/index.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';

export async function extractLocationsOfKeyframe({
  root,
  directory,
  sources,
  smc,
  diagnostics,
}: ExtractorArguments): Promise<Map<string, Export[]>> {
  const locationsOfKeyframe: Map<string, Export[]> = new Map();

  const atRules: AtRule[] = [];
  root.walkAtRules('keyframes', (atRule) => {
    atRules.push(atRule);
  });

  for (const atRule of atRules) {
    let {
      source,
      position: { line, column },
    } = smc.node(atRule);
    column += atRule.name.length + 1 + (atRule.raws.afterName?.length ?? 0);

    await loadSource(sources, path.resolve(directory, source))
      .then((text) => {
        const snippet = [
          `###### ${path.basename(source)}:${line + 1}`,
          '```css',
          text.lines(line),
          '```',
          empty,
        ].join('\n');

        locationsOfKeyframe.getOrInsert(atRule.params, []).push({
          type: 'keyframe',
          snippet,
          location: new Location(source, line, column, line, column + atRule.params.length),
          scope: 'local', // TODO
        });
      })
      .catch((error) => {
        diagnostics.push(
          new Diagnostic(
            new Range(line, column, line, column + atRule.params.length),
            error.message,
            DiagnosticSeverity.Error,
          ),
        );
      });
  }

  return locationsOfKeyframe;
}
