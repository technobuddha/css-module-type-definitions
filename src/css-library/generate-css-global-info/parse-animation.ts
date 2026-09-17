import { quote, re } from '@technobuddha/library';
import valueParser, { type Node } from 'postcss-value-parser';
import { DiagnosticSeverity } from 'vscode';

import { Diagnostic, type Position, Range } from '../helpers/index.ts';

const keyword = re`inherit|initial|unset|revert|revert-layer`;
const numeric = re`-?\d*\.?\d+(?:ms|s)?`;
const duration = re`auto`;
const easing = re`ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end`;
const iteration = re`infinite`;
const direction = re`normal|reverse|alternate|alternate-reverse`;
const fill = re`forwards|backwards|both`;
const play = re`running|paused`;
const easingFunction = re`steps|cubic-bezier`;
const reAnimation = re`^${numeric}|${duration}|${easing}|${iteration}|${direction}|${fill}|${play}$`;
const reFunction = re`^${easingFunction}$`;
const reKeyword = re`^${keyword}$`;
const reIdent = /^(?!\d)(?!-\d).+$/v;

export function parseAnimation(value: string): Node[] {
  const animationNames: Node[] = [];
  let name: Node | null = null;
  let invalid = false;
  let keyword = false;
  let other = false;

  const next = (): void => {
    if (!invalid && !keyword) {
      if (name && (name.type !== 'word' || name.value !== 'none')) {
        animationNames.push(name);
      }
    }

    name = null;
    invalid = keyword;
    other = false;
  };

  for (const node of valueParser(value).nodes) {
    switch (node.type) {
      case 'word': {
        if (reKeyword.test(node.value)) {
          if (keyword || name || other || animationNames.length > 0) {
            invalid = true;
          } else {
            keyword = true;
          }
          break;
        }

        if (reAnimation.test(node.value)) {
          other = true;
          break;
        }

        if (node.value === 'none') {
          name ??= node;
          break;
        }

        if (reIdent.test(node.value)) {
          if (name) {
            invalid = true;
          } else {
            name = node;
          }
        } else {
          other = true;
        }
        break;
      }

      case 'function': {
        if (reFunction.test(node.value)) {
          other = true;
          break;
        }

        invalid = true;
        break;
      }

      case 'string': {
        if (name) {
          invalid = true;
          break;
        }

        name = node;
        break;
      }

      case 'div': {
        if (node.value === ',') {
          next();
          break;
        }

        invalid = true;
        break;
      }

      case 'unicode-range': {
        invalid = true;
        break;
      }

      case 'space':
      case 'comment': {
        break;
      }

      // no default
    }
  }
  next();
  return animationNames;
}

export function parseAnimationName(value: string): Node[] {
  const animationNames: Node[] = [];
  let name: Node | null = null;
  let invalid = false;
  let keyword = false;

  const next = (): void => {
    if (!invalid && !keyword) {
      if (name && (name.type !== 'word' || name.value !== 'none')) {
        animationNames.push(name);
      }
    }

    name = null;
    invalid = keyword;
  };

  for (const node of valueParser(value).nodes) {
    switch (node.type) {
      case 'word': {
        if (reKeyword.test(node.value)) {
          if (keyword || name || animationNames.length > 0) {
            invalid = true;
          } else {
            keyword = true;
          }
          break;
        }

        if (reIdent.test(node.value)) {
          if (name) {
            invalid = true;
          } else {
            name = node;
          }
        } else {
          invalid = true;
        }
        break;
      }

      case 'function': {
        invalid = true;
        break;
      }

      case 'string': {
        if (name) {
          invalid = true;
          break;
        }

        name = node;
        break;
      }

      case 'div': {
        if (node.value === ',') {
          next();
          break;
        }

        invalid = true;
        break;
      }

      case 'unicode-range': {
        invalid = true;
        break;
      }

      case 'space':
      case 'comment': {
        break;
      }

      // no default
    }
  }
  next();
  return animationNames;
}

export function parseKeyframes(
  value: string,
  position: Position,
  diagnostics: Diagnostic[],
): Node | null {
  let name: Node | null = null;

  const syntaxError = (node: Node): null => {
    diagnostics.push(
      new Diagnostic(
        new Range(position.add(node.sourceIndex), position.add(node.sourceEndIndex)),
        `Invalid keyframes syntax.`,
        DiagnosticSeverity.Error,
      ),
    );
    return null;
  };

  for (const node of valueParser(value).nodes) {
    switch (node.type) {
      case 'word': {
        if (reKeyword.test(node.value) || !reIdent.test(node.value)) {
          diagnostics.push(
            new Diagnostic(
              new Range(position.add(node.sourceIndex), position.add(node.sourceEndIndex)),
              `Illegal keyframes name: ${quote(node.value)}`,
              DiagnosticSeverity.Error,
            ),
          );
          return null;
        }

        if (name) {
          return syntaxError(node);
        }

        if (reAnimation.test(node.value) || reFunction.test(node.value)) {
          diagnostics.push(
            new Diagnostic(
              new Range(position.add(node.sourceIndex), position.add(node.sourceEndIndex)),
              `Keyframes name: ${quote(node.value)} is not recommended`,
              DiagnosticSeverity.Warning,
            ),
          );
        }

        name = node;
        break;
      }

      case 'string': {
        if (name) {
          return syntaxError(node);
        }

        name = node;
        break;
      }

      case 'function':
      case 'div':
      case 'unicode-range': {
        return syntaxError(node);
      }

      case 'space':
      case 'comment': {
        break;
      }

      // no default
    }
  }
  return name;
}
