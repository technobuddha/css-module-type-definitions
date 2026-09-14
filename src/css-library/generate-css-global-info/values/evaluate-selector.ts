import {
  type Position,
  Range,
  toRange,
  type ValueInformation,
  walkSelectors,
} from '../../helpers/index.ts';

export function evaluateSelectors({
  selectors,
  position,
  informationOfValues,
}: {
  selectors: string;
  position: Position;
  informationOfValues: Map<string, ValueInformation>;
}): void {
  for (const selector of walkSelectors(selectors)) {
    const range = toRange(selector);

    switch (selector.type) {
      case 'attribute': {
        if (selector.attribute) {
          const info = informationOfValues.get(selector.attribute);
          if (info?.isReady) {
            const offset = selector.spaces.attribute?.before?.length ?? 0;
            const { length } = selector.attribute;

            info.used(
              'attribute',
              new Range(
                position.add(range.start).add(offset),
                position.add(range.start).add(offset + length),
              ),
              info.value,
            );
            selector.attribute = info.value;
          }
        }
        break;
      }

      case 'class': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info?.isReady) {
            info.used(
              'class',
              new Range(position.add(range.start), position.add(range.end)),
              info.value,
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'id': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info?.isReady) {
            info.used(
              'id',
              new Range(position.add(range.start), position.add(range.end)),
              info.value,
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'tag': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info?.isReady) {
            info.used(
              'tag',
              new Range(position.add(range.start).add(-1), position.add(range.end)),
              info.value,
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'pseudo': {
        if (selector.value) {
          const offset = selector.value.startsWith('::') ? 1 : 0;
          const info = informationOfValues.get(selector.value.slice(offset+1));
          if (info?.isReady) {
            info.used(
              'pseudo',
              new Range(position.add(range.start).add(offset), position.add(range.end)),
              info.value,
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'combinator':
      case 'comment':
      case 'nesting':
      case 'root':
      case 'selector':
      case 'string':
      case 'universal':
      default: {
        break;
      }

      // no default
    }
  }
}
