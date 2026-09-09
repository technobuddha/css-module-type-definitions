import { type Position, Range } from '../../position.ts';

import { type ValueInformation } from './value-information.ts';

export function evaluateProp({
  prop,
  position,
  informationOfValues,
}: {
  prop: string;
  position: Position;
  informationOfValues: Map<string, ValueInformation>;
}): string {
  const info = informationOfValues.get(prop);
  if (info) {
    const range = new Range(position, position.add({ column: prop.length }));
    info.used('prop', range);
    return info.value;
  }
  return prop;
}
