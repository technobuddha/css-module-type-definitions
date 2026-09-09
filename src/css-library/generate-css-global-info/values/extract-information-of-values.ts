import path from 'node:path';

import { unquote } from '@technobuddha/library';
import postcss, { type AtRule, type Declaration, type Rule } from 'postcss';

import { Location, Position } from '../../position.ts';
import { Text } from '../../text.ts';

import { type ExtractorArguments } from '../generate-css-global-info.ts';
import { loadSource } from '../load-source.ts';
import { mappedPosition } from '../mapped-position.ts';

import { evaluateProp } from './evaluate-prop.ts';
import { evaluateSelectors } from './evaluate-selector.ts';
import { evaluateValue } from './evaluate-value.ts';
import { ValueInformation } from './value-information.ts';

const reImport = /(.+)(\s+from\s+)(.+)/v;
const reVar = /([a-zA-Z_\-][\w\-]*)(\s*:\s*)(.+)/v;
const reName = /([^\s]+)(?:(\s+as\s+)(.+))?/v;

export async function extractInformationOfValues(
  args: ExtractorArguments,
  full = true,
): Promise<Map<string, ValueInformation>> {
  const { root, smc, directory, sources, importedFiles, logger } = args;
  const informationOfValues: Map<string, ValueInformation> = new Map();

  const atRules: AtRule[] = [];
  root.walkAtRules('value', (atRule) => {
    atRules.push(atRule);
  });

  for (const atRule of atRules) {
    if (atRule.params) {
      let {
        source,
        position: { line, column },
      } = mappedPosition(atRule, smc);
      column += atRule.name.length + 1 + (atRule.raws.afterName?.length ?? 0);

      const importMatch = reImport.exec(atRule.params);
      const varMatch = reVar.exec(atRule.params);

      if (importMatch) {
        const [, variables, from, origin] = importMatch;
        const position = new Position(line, column + variables.length + from.length);

        const importedFrom = path.resolve(
          directory,
          unquote(evaluateValue({ value: origin, position, informationOfValues })),
        );

        importedFiles.add(importedFrom);
        const css = await loadSource(sources, importedFrom);

        const locVal = await extractInformationOfValues(
          {
            ...args,
            smc: importedFrom,
            directory: path.dirname(importedFrom),
            root: postcss().process(css.text, { from: path.basename(importedFrom) }).root,
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

            const snippet = await loadSource(sources, path.resolve(directory, source)).then(
              (text) => text.lines(line),
            );

            const parent = locVal.get(importName);

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
                location: new Location(source, line, col, line, col + finalName.length),
                importedFrom,
                importName,
              });
          }
        }
      } else if (varMatch) {
        const [, varName, colon, value] = varMatch;
        const snippet = await loadSource(sources, path.resolve(directory, source)).then((text) =>
          text.lines(line),
        );

        const position = new Position(line, column + varName.length + colon.length);
        informationOfValues
          .getOrInsertComputed(varName, () => new ValueInformation(varName))
          .define({
            value: evaluateValue({ value, position, informationOfValues }),
            snippet,
            location: new Location(source, line, column, line, column + varName.length),
          });
      } else {
        logger.error(`Unsupported "@value" rule ${atRule.params}`);
      }
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
      } = mappedPosition(decl, smc);

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
      } = mappedPosition(rule, smc);
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
