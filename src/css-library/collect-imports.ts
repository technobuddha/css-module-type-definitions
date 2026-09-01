import { empty } from '@technobuddha/library';
import { type AtRule, type Plugin, type PluginCreator } from 'postcss';

import { type Loc } from './position.ts';

export type Import = {
  readonly type: 'collect-imports';
  readonly import: string;
  readonly location: Loc;
};

const collectImports: PluginCreator<void> = (): Plugin => ({
  postcssPlugin: 'collect-imports',

  AtRule: {
    import(rule: AtRule, { result }) {
      result.messages.push({
        type: 'collect-imports',
        import: rule.params,
        location: {
          source: rule.source?.input.file ?? empty,
          range: {
            start: {
              line: (rule.source?.start?.line ?? 1) - 1,
              column: (rule.source?.start?.column ?? 1) - 1,
            },
            end: {
              line: (rule.source?.end?.line ?? 1) - 1,
              column: (rule.source?.end?.column ?? 1) - 1,
            },
          },
        },
      });
    },
  },
});
collectImports.postcss = true;

export default collectImports;
