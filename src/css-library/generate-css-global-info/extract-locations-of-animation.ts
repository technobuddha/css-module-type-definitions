import { delimited, space } from '@technobuddha/library';

import { Location } from '../position.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';
import { mappedPosition } from './mapped-position.ts';

export async function extractLocationsOfAnimation({
  root,
  smc,
}: ExtractorArguments): Promise<Map<string, Location[]>> {
  const locationsOfAnimation: Map<string, Location[]> = new Map();
  root.walkDecls(/^(?:animation-name|animation)$/v, (decl) => {
    let {
      source,
      position: { line, column },
    } = mappedPosition(decl, smc);
    column += decl.prop.length + (decl.raws.between?.length ?? 0);

    const value = delimited(decl.value, space, 0);

    locationsOfAnimation
      .getOrInsert(value, [])
      .push(new Location(source, line, column, line, column));
  });

  return locationsOfAnimation;
}
