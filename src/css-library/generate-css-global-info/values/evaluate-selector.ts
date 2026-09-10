import { type Position, Range, type ValueInformation, walkSelectors } from '../../helpers/index.ts';

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
    const range = new Range(
      (selector.source?.start?.line ?? 1) - 1,
      (selector.source?.start?.column ?? 1) - 1,
      (selector.source?.end?.line ?? 1) - 1,
      (selector.source?.end?.column ?? 1) - 1,
    );

    switch (selector.type) {
      case 'attribute': {
        if (selector.attribute) {
          const info = informationOfValues.get(selector.attribute);
          if (info) {
            const offset = selector.spaces.attribute?.before?.length ?? 0;
            const { length } = selector.attribute;

            info.used(
              'attribute',
              new Range(
                position.add(range.start).add({ column: offset + 1 }),
                position.add(range.start).add({ column: offset + length + 1 }),
              ),
            );
            selector.attribute = info.value;
          }
        }
        break;
      }

      case 'class': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info) {
            info.used(
              'class',
              new Range(
                position.add(range.start).add({ column: 1 }),
                position.add(range.end).add({ column: 1 }),
              ),
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'id': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info) {
            info.used(
              'id',
              new Range(
                position.add(range.start).add({ column: 1 }),
                position.add(range.end).add({ column: 1 }),
              ),
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'tag': {
        if (selector.value) {
          const info = informationOfValues.get(selector.value);
          if (info) {
            info.used(
              'tag',
              new Range(position.add(range.start), position.add(range.end).add({ column: 1 })),
            );
            selector.value = info.value;
          }
        }
        break;
      }

      case 'pseudo': {
        if (selector.value) {
          const offset = selector.value.startsWith('::') ? 2 : 1;
          const info = informationOfValues.get(selector.value.slice(offset));
          if (info) {
            info.used(
              'pseudo',
              new Range(
                position.add(range.start).add({ column: offset }),
                position.add(range.end).add({ column: 1 }),
              ),
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
