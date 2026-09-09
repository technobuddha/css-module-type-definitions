import selectorParser, { type Node } from 'postcss-selector-parser';

export function walkSelectors(selector: string): Node[] {
  return selectorParser((selectors) => {
    const results: Node[] = [];
    selectors.walk((sel) => {
      results.push(sel);
    });
    return results;
  }).transformSync(selector);
}
