import { type CSSModulesOptions, resolveConfig, type ResolvedCSSOptions } from 'vite';

type ViteCss = Omit<ResolvedCSSOptions, 'modules' | 'lightningcss'> & {
  modules?: Omit<CSSModulesOptions, 'generateScopedName' | 'localsConvention'> & {
    generateScopedName?: Extract<CSSModulesOptions['generateScopedName'], string>;
    localsConvention?: Extract<CSSModulesOptions['localsConvention'], string>;
  };
};

export async function readViteConfig(): Promise<ViteCss> {
  const viteConfig = await resolveConfig(
    { root: process.cwd() },
    'build',
    'production',
    'production',
  );
  const cssConfig = viteConfig?.css ?? {};

  if (cssConfig.modules === false) {
    delete cssConfig.modules;
  }
  if (typeof cssConfig.modules?.generateScopedName === 'function') {
    delete cssConfig.modules.generateScopedName;
  }
  if (typeof cssConfig?.modules?.localsConvention === 'function') {
    delete cssConfig.modules.localsConvention;
  }

  return cssConfig as ViteCss;
}
