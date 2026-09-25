import { conjoin, toArray } from '@technobuddha/library';
import { type Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { UriSet } from './uri-set.ts';

const URI_LIST_LIMIT = 5;

export function uriList(...uri: (Uri | Iterable<Uri>)[]): string {
  const set = new UriSet(uri.flatMap((u) => toArray(u)));

  if (set.size > URI_LIST_LIMIT) {
    return conjoin(
      [
        ...Array.from(set.values())
          .slice(0, URI_LIST_LIMIT)
          .map((u) => `⟨${Utils.basename(u)}⟩`),
        `${set.size - URI_LIST_LIMIT} more`,
      ],
      { conjunction: '… and' },
    );
  }

  return conjoin(set.map((u) => `⟨${Utils.basename(u)}⟩`));
}
