import path from 'node:path';

import { type AtRule } from 'postcss';
import { DiagnosticSeverity } from 'vscode';

import { Location, Range } from '../position.ts';

import { Diagnostic } from './diagnostic.ts';
import { type ExtractorArguments } from './generate-css-global-info.ts';
import { loadSource } from './load-source.ts';
import { type LocationAndSnippet } from './location-and-snippet.ts';
import { mappedPosition } from './mapped-position.ts';

export async function extractLocationsOfKeyframe({
  root,
  directory,
  sources,
  smc,
  diagnostics,
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

    await loadSource(sources, path.resolve(directory, source))
      .then((text) => {
        const snippet = [
          `###### ${path.basename(source)}:${line + 1}`,
          '```css',
          text.lines(line),
          '```',
        ].join('\n');

        locationsOfKeyframe.getOrInsert(atRule.params, []).push({
          snippet,
          location: new Location(source, line, column, line, column + atRule.params.length),
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
