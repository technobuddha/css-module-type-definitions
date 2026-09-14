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
  if (info?.isReady) {
    const range = new Range(position, position.add(prop.length));
    info.used('prop', range, info.value);
    return info.value;
  }
  return prop;
}
