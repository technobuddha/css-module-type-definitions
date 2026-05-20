import { zipperMerge } from '@technobuddha/library';
import postcss, { AtRule, type Node, Rule } from 'postcss';
import { extract } from 'string-extract-class-names';

import { type Logger } from '../../common/logger.ts';

import { getPositionOfOffset, type Offset, offsetAdd } from '../offset.ts';

type ClassOffset = {
  name: string;
  offset: Offset;
};

type ExtractClassOffsetsFromCssArguments = {
  filename: string;
  logger: Logger;
  less?: boolean;
};

export function extractClassOffsetsFromCss(
  css: string,
  { filename, logger, less = false }: ExtractClassOffsetsFromCssArguments,
): Map<string, Offset> {
  const classes: Map<string, Offset> = new Map();

  postcss()
    .process(css, { from: filename })
    .root.walk((node) => {
      for (const { name, offset } of walkNode(node, logger, less)) {
        // Only the first definition of an exported name will be tracked.
        if (!classes.has(name)) {
          const ruleOffset: Offset = {
            line: node.source?.start?.line ?? 1,
            column: node.source?.start?.column ?? 1,
          };
          classes.set(name, offsetAdd(ruleOffset, offset));
        }
      }
    });

  return classes;
}

function* walkNode(node: Node, logger: Logger, less: boolean): Generator<ClassOffset> {
  if (node instanceof Rule) {
    yield* walkRule(node, less, logger);
  }
  if (node instanceof AtRule) {
    yield* walkAtRule(node, logger);
  }
}

function* walkRule({ selector }: Rule, less: boolean, _logger: Logger): Generator<ClassOffset> {
  const { res, ranges } = extract(selector);
  for (const [name, [start]] of zipperMerge(res, ranges ?? [])) {
    if (name.startsWith('.')) {
      const offset = less ? { line: 0, column: start } : getPositionOfOffset(selector, start);
      yield { name: name.slice(1), offset };
    }
  }
}

function* walkAtRule(atRule: AtRule, logger: Logger): Generator<ClassOffset> {
  const baseOffset: Offset = {
    line: 0,
    column: `@${atRule.name}`.length + (atRule.raws.afterName?.length ?? 0),
  };

  if (atRule.name === 'value' && atRule.params) {
    const importReg = /(.+)\s+from\s+.+/isv;
    const varReg = /([a-z_\-][\w\-]*)\s*:.+/isv;
    const importMatch = importReg.exec(atRule.params);
    const varMatch = varReg.exec(atRule.params);
    if (importMatch) {
      const [, importNameRawPatterns] = importMatch;
      const importPatterns = importNameRawPatterns.split(',');
      const importNamesOffsets = importPatterns.reduce<number[]>((offsets, pattern) => {
        offsets.push((offsets.at(-1) ?? 0) + pattern.length + 1);
        return offsets;
      }, []);
      for (const [i, pattern] of importPatterns.entries()) {
        const nameReg = /(.+\s+as\s+)?(.+)/iv;
        const nameMatch = nameReg.exec(pattern);
        if (nameMatch) {
          const [, rename, finalName] = nameMatch;

          yield {
            name: finalName,
            offset: offsetAdd(
              getPositionOfOffset(
                atRule.params,
                (importNamesOffsets[i - 1] ?? 0) + nameMatch.index + (rename?.length ?? 0),
              ),
              baseOffset,
            ),
          };
        }
      }
    } else if (varMatch) {
      const [, varName] = varMatch;

      yield { name: varName, offset: baseOffset };
    } else {
      logger.error(`Unsupported "@value" rule input: ${atRule.params}`);
    }
  } else if (atRule.name === 'keyframes') {
    yield { name: atRule.params, offset: baseOffset };
  }
}
