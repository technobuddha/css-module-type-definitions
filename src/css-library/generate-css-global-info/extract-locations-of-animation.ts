import { Location } from '../helpers/index.ts';

import { type ExtractorArguments } from './generate-css-global-info.ts';
import { parseAnimation, parseAnimationName } from './parse-animation.ts';

export async function extractLocationsOfAnimation({
  root,
  smc,
}: ExtractorArguments): Promise<Map<string, Location[]>> {
  const locationsOfAnimation: Map<string, Location[]> = new Map();
  root.walkDecls(/^animation-name|animation$/v, (decl) => {
    const { source, position } = smc.node(decl);
    const begin = position.add(decl.prop.length + (decl.raws.between?.length ?? 0));

    if (decl.prop === 'animation') {
      for (const node of parseAnimation(decl.value)) {
        const start = begin.add(node.sourceIndex);
        const end = begin.add(node.sourceEndIndex);

        locationsOfAnimation.getOrInsert(node.value, []).push(new Location(source, start, end));
      }
    } else {
      for (const node of parseAnimationName(decl.value)) {
        const start = begin.add(node.sourceIndex);
        const end = begin.add(node.sourceEndIndex);

        locationsOfAnimation.getOrInsert(node.value, []).push(new Location(source, start, end));
      }
    }
  });

  return locationsOfAnimation;
}
