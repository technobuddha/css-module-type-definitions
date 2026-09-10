import path from 'node:path';

import { toError, unquote } from '@technobuddha/library';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

import {
  Diagnostic,
  DiagnosticSeverity,
  loadSource,
  Location,
  Position,
  Range,
  SourceMapConsumer,
  Text,
  ValueInformation,
} from '../../helpers/index.ts';

import { type ExtractorArguments } from '../generate-css-global-info.ts';

import { evaluateProp } from './evaluate-prop.ts';
import { evaluateSelectors } from './evaluate-selector.ts';
import { evaluateValue } from './evaluate-value.ts';

const reImport = /(.+)(\s+from\s+)(.+)/v;
const reVar = /([a-zA-Z_\-][\w\-]*)(\s*:\s*)(.+)/v;
const reName = /([^\s]+)(?:(\s+as\s+)(.+))?/v;

export async function extractInformationOfValues(
  args: ExtractorArguments,
  full = true,
): Promise<Map<string, ValueInformation>> {
  const { root, smc, directory, sources, importedFiles, diagnostics, logger } = args;
  const informationOfValues: Map<string, ValueInformation> = new Map();

  const atRules: AtRule[] = [];
  root.walkAtRules('value', (atRule) => {
    atRules.push(atRule);
  });

  for (const atRule of atRules) {
    const { source, position } = smc.node(atRule);
    const column = position.column + atRule.name.length + 1 + (atRule.raws.afterName?.length ?? 0);

    const importMatch = reImport.exec(atRule.params);
    const varMatch = reVar.exec(atRule.params);

    if (importMatch) {
      const [, variables, from, origin] = importMatch;
      const pos = new Position(position.line, column + variables.length + from.length);

      const importedFrom = path.resolve(
        directory,
        unquote(evaluateValue({ value: origin, position: pos, informationOfValues })),
      );

      await loadSource(sources, importedFrom)
        .then(async (css) => {
          importedFiles.add(importedFrom);

          const importedValues = await extractInformationOfValues(
            {
              ...args,
              smc: new SourceMapConsumer({ source: importedFrom, logger }),
              directory: path.dirname(importedFrom),
              root: postcss().process(css.source, { from: path.basename(importedFrom) }).root,
            },
            false,
          );

          const variableOffsets = variables
            .matchAll(/\s*([^,]+?)\s*(?=,|$)/gv)
            .map((m) => ({
              name: m[1],
              offset: m.index + m[0].indexOf(m[1]),
            }))
            .toArray();

          for (const { name, offset } of variableOffsets) {
            const nameMatch = reName.exec(name);

            if (nameMatch) {
              const [, importName, as, rename] = nameMatch;
              const finalName = rename ?? importName;

              await loadSource(sources, path.resolve(directory, source))
                .then((text) => {
                  const snippet = [
                    `###### ${path.basename(source)}:${position.line + 1}`,
                    '```css',
                    text.lines(position.line),
                    '```',
                  ].join('\n');

                  const parent = importedValues.get(importName);

                  const col =
                    column +
                    offset +
                    nameMatch.index +
                    (as?.length ?? 0) +
                    (rename ? importName.length : 0);

                  informationOfValues
                    .getOrInsertComputed(finalName, () => new ValueInformation(finalName))
                    .import({
                      parent,
                      snippet,
                      location: new Location(
                        source,
                        position.line,
                        col,
                        position.line,
                        col + finalName.length,
                      ),
                      importedFrom,
                      importName,
                    });
                })
                .catch((error) => {
                  diagnostics.push(
                    new Diagnostic(
                      new Range(position, position.add(new Text(atRule.toString()).size)),
                      toError(error).message,
                      DiagnosticSeverity.Error,
                    ),
                  );
                });
            }
          }
        })
        .catch((error) => {
          diagnostics.push(
            new Diagnostic(
              new Range(position, position.add(new Text(atRule.toString()).size)),
              toError(error).message,
              DiagnosticSeverity.Error,
            ),
          );
        });
    } else if (varMatch) {
      const [, varName, colon, value] = varMatch;

      await loadSource(sources, path.resolve(directory, source))
        .then((text) => {
          const snippet = [
            `###### ${path.basename(source)}:${position.line + 1}`,
            '```css',
            text.lines(position.line),
            '```',
          ].join('\n');

          const pos = new Position(position.line, column + varName.length + colon.length);
          informationOfValues
            .getOrInsertComputed(varName, () => new ValueInformation(varName))
            .define({
              value: evaluateValue({ value, position: pos, informationOfValues }),
              snippet,
              location: new Location(
                source,
                position.line,
                column,
                position.line,
                column + varName.length,
              ),
            });
        })
        .catch((error) => {
          diagnostics.push(
            new Diagnostic(
              new Range(position, position.add(new Text(atRule.toString()).size)),
              toError(error).message,
              DiagnosticSeverity.Error,
            ),
          );
        });
    } else {
      diagnostics.push(
        new Diagnostic(
          new Range(position, position.add(new Text(atRule.toString()).size)),
          `@value syntax error`,
          DiagnosticSeverity.Error,
        ),
      );
    }
  }

  if (full && informationOfValues.size > 0) {
    const decls: Declaration[] = [];
    root.walkDecls((decl) => {
      decls.push(decl);
    });

    for (const decl of decls) {
      const {
        position: { line, column },
      } = smc.node(decl);

      evaluateProp({
        prop: decl.prop,
        position: new Position(line, column),
        informationOfValues,
      });

      const position = new Position(line, column).add(new Text(decl.prop + decl.raws.between).size);
      evaluateValue({ value: decl.value, position, informationOfValues });
    }

    const rules: Rule[] = [];
    root.walkRules((rule) => {
      rules.push(rule);
    });

    for (const rule of rules) {
      const {
        position: { line, column },
      } = smc.node(rule);
      const position = new Position(line, column);

      evaluateSelectors({
        selectors: rule.selector,
        position,
        informationOfValues,
      });
    }
  }

  return informationOfValues;
}
