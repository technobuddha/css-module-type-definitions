import path from 'node:path';

import { conjoin, empty, unindent } from '@technobuddha/library';
import postcss, { type AtRule, type Rule } from 'postcss';
import postcssModulesLocalByDefault from 'postcss-modules-local-by-default';
import selectorParser from 'postcss-selector-parser';

import {
  Diagnostic,
  DiagnosticSeverity,
  type Export,
  Location,
  Range,
  toDiagnosticSeverity,
  toRange,
} from '../helpers/index.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';
import { parseKeyframes } from './parse-animation.ts';

export async function extractLocationsOfExports({
  root,
  text,
  directory,
  smc,
  diagnostics,
  options,
}: ExtractorArguments): Promise<Map<string, Export[]>> {
  const globals: Map<string, 'global' | 'local' | 'both'> = new Map();
  const locationsOfExport: Map<string, Export[]> = new Map();

  const globalWalker = (node: postcss.Rule | postcss.AtRule): void => {
    const types = node instanceof postcss.AtRule ? ['tag'] : ['class', 'id'];

    selectorParser((selectors) => {
      let scope: 'global' | 'local' | 'both' = 'global';

      selectors.walk((selectorNode) => {
        if (selectorNode.type === 'pseudo' && selectorNode.value === ':local') {
          scope = 'local';
        } else if (types.includes(selectorNode.type)) {
          const current = globals.get(selectorNode.value!);
          if (current !== undefined && current !== scope) {
            globals.set(selectorNode.value!, 'both');
          } else {
            globals.set(selectorNode.value!, scope);
          }
          scope = 'global';
        }
      });
    }).transformSync(node instanceof postcss.Rule ? node.selector : node.params);
  };

  await postcss()
    .use(postcssModulesLocalByDefault({ mode: options.css.modules.scopeBehaviour ?? 'local' }))
    .process(text.source, { map: false })
    .then(({ root, css }) => {
      void css;
      root.walk((node) => {
        if (node.type === 'rule' || (node.type === 'atrule' && node.name === 'keyframes')) {
          globalWalker(node);
        }
      });
    })
    .catch((error) => {
      diagnostics.push(
        new Diagnostic(
          new Range(0, 0, 0, 0),
          `Error processing CSS: ${error.message}`,
          DiagnosticSeverity.Error,
        ),
      );
    });

  const exportWalker = (node: Rule): void => {
    const { source, position } = smc.node(node);

    selectorParser((selectors) => {
      selectors.walk((selNode) => {
        const { value, type } = selNode;

        if (value) {
          if (type === 'class' || type === 'id') {
            const snippet = [
              `###### ${path.basename(source)}:${position.line + 1}`,
              '```css',
              unindent(node.toString()),
              '```',
              empty,
            ].join('\n');

            const range = toRange(selNode);
            const location = new Location(path.resolve(directory, source), position.add(range));

            let scope = globals.get(value) ?? 'local';
            if (scope === 'both') {
              scope = 'global';

              if (options.localAndGlobalExportsDiagnostics !== 'none') {
                diagnostics.push(
                  new Diagnostic(
                    location.range,
                    `"${value}" defined as both global and local.`,
                    toDiagnosticSeverity(options.localAndGlobalExportsDiagnostics),
                  ),
                );
              }
              globals.set(value, scope);
            }

            locationsOfExport.getOrInsert(value, []).push({
              type,
              snippet,
              location,
              scope,
            });
          }
        }
      });
    }).transformSync(node.selector);
  };

  const keyframeWalker = (node: AtRule): void => {
    let { source, position } = smc.node(node);
    position = position.add(node.name.length + (node.raws.afterName?.length ?? 0) + 1);

    const name = parseKeyframes(node.params, position, diagnostics);
    if (name) {
      const prev = locationsOfExport.get(name.value);
      if (prev) {
        if (prev.some((p) => p.type === 'keyframes')) {
          diagnostics.push(
            new Diagnostic(
              new Range(position.add(name.sourceIndex), position.add(name.sourceEndIndex)),
              `"${name.value}" is already defined as a keyframes.`,
              DiagnosticSeverity.Error,
            ),
          );
        }
      }
      const location = new Location(
        path.resolve(directory, source),
        position.add(name.sourceIndex),
        position.add(name.sourceEndIndex),
      );
      locationsOfExport.getOrInsert(name.value, []).push({
        type: 'keyframes',
        snippet: [
          `###### ${path.basename(source)}:${position.line + 1}`,
          '```css',
          unindent(node.toString()),
          '```',
          empty,
        ].join('\n'),
        location,
        scope: 'local',
      });
    }
  };

  root.walk((node) => {
    if (node.type === 'rule') {
      exportWalker(node);
    } else if (node.type === 'atrule' && node.name === 'keyframes') {
      keyframeWalker(node);
    }
  });

  if (options.multipleTypeExportsDiagnostics !== 'none') {
    for (const [name, exports] of locationsOfExport) {
      if (exports.some((e) => e.type !== exports.at(0)!.type)) {
        const types = new Set(exports.map((e) => e.type));

        diagnostics.push(
          new Diagnostic(
            exports.at(0)!.location.range,
            `"${name}" is defined as ${conjoin(types)}.`,
            toDiagnosticSeverity(options.multipleTypeExportsDiagnostics),
          ),
        );
      }
    }
  }
  return locationsOfExport;
}
