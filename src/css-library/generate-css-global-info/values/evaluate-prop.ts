import { type Position, Range, type ValueInformation } from '../../helpers/index.ts';

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
