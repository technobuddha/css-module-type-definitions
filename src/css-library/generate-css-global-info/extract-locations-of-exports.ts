import path from 'node:path';

import { conjoin, empty, unindent } from '@technobuddha/library';
import postcss from 'postcss';
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
    .use(postcssModulesLocalByDefault({ mode: 'local' }))
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

  const exportWalker = (node: postcss.Node, selector: string, keyframes: boolean): void => {
    let { source, position } = smc.node(node);
    let extend = 0;
    if (node instanceof postcss.AtRule) {
      position = position.add({ column: node.name.length + (node.raws.afterName?.length ?? 0) });
      extend = 1;
    }

    selectorParser((selectors) => {
      selectors.walk((selNode) => {
        const name = selNode.value!;

        if ((keyframes ? ['tag'] : ['class', 'id']).includes(selNode.type)) {
          const snippet = [
            `###### ${path.basename(source)}:${position.line + 1}`,
            '```css',
            unindent(node.toString()),
            '```',
            empty,
          ].join('\n');

          const range = toRange(selNode).extend(extend);
          const type =
            selNode.type === 'class' || selNode.type === 'id' ? selNode.type : 'keyframe';
          const location = new Location(path.resolve(directory, source), position.add(range));

          let scope = globals.get(name) ?? 'local';
          if (scope === 'both') {
            scope = 'global';

            if (options.localAndGlobalExportsDiagnostics !== 'none') {
              diagnostics.push(
                new Diagnostic(
                  location.range,
                  `"${name}" defined as both global and local.`,
                  toDiagnosticSeverity(options.localAndGlobalExportsDiagnostics),
                ),
              );
            }
            globals.set(name, scope);
          }

          locationsOfExport.getOrInsert(name, []).push({
            type,
            snippet,
            location,
            scope,
          });
        }
      });
    }).transformSync(selector);
  };

  root.walk((node) => {
    if (node.type === 'rule') {
      exportWalker(node, node.selector, false);
    } else if (node.type === 'atrule' && node.name === 'keyframes') {
      exportWalker(node, node.params, true);
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
