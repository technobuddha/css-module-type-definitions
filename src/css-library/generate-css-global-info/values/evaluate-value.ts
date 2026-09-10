import valueParser from 'postcss-value-parser';

import { type Position, Range, Text, type ValueInformation } from '../../helpers/index.ts';

export function evaluateValue({
  value,
  position,
  informationOfValues,
}: {
  value: string;
  position: Position;
  informationOfValues: Map<string, ValueInformation>;
}): string {
  const text = new Text(value);
  const tree = valueParser(value);
  tree.walk((node) => {
    switch (node.type) {
      case 'word': {
        const valueInfo = informationOfValues.get(node.value);
        if (valueInfo) {
          const start = position.add(text.positionAt(node.sourceIndex));
          const end = position.add(text.positionAt(node.sourceEndIndex));
          const range = new Range(start, end);

          valueInfo.used('word', range);
          node.value = valueInfo.value;
        }
        break;
      }

      case 'function': {
        const valueInfo = informationOfValues.get(node.value);
        if (valueInfo) {
          const start = position.add(text.positionAt(node.sourceIndex));
          const end = start.add({ column: node.value.length });
          const range = new Range(start, end);

          valueInfo.used('function', range);
          node.value = valueInfo.value;
        }
        break;
      }

      case 'string':
      case 'div':
      case 'space':
      case 'comment':
      case 'unicode-range': {
        break;
      }

      // no default
    }
  });
  return valueParser.stringify(tree.nodes);
}
