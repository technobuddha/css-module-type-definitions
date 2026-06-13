import { locatePackageRoot } from '@technobuddha/library';
import { type Plugin } from 'vite';

import { FileIgnorer, Optionator, type Options, watch } from '../common/index.ts';

export const pluginCssModuleTypeDefinitions = async (opts?: Partial<Options>): Promise<Plugin> => {
  const root = (await locatePackageRoot()) ?? process.cwd();
  let ignorer: FileIgnorer;
  let optionator: Optionator;

  return {
    name: 'css-module-type-definitions',
    apply: 'serve',
    async configureServer({ config }) {
      if (config.css.modules) {
        optionator = await Optionator.create(opts, {
          watch: false,
          vite: config,
        });

        ignorer = await FileIgnorer.create({ root, logger: optionator.logger, watch: true });

        void watch({ root, optionator, ignorer });
      } else {
        throw new Error('css.modules must be enabled in vite.config');
      }
    },
  };
};
