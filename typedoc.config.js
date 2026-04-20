// 🚨
// 🚨 CHANGES TO THIS FILE WILL BE OVERRIDDEN
// 🚨
//@ts-check

/** @type import('typedoc').TypeDocOptions */
const config = {
  // Configuration
  name: 'css-module-type-definitions',
  tsconfig: 'src/tsconfig.typedoc.json',
  plugin: ['@technobuddha/project/plugin-typedoc'],
  // Input
  entryPointStrategy: 'resolve',
  entryPoints: ['src/index.ts'],
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  gitRevision: 'main',
  readme: 'doc/intro.md',
  basePath: '.',
  // Output
  emit: 'none',
  navigation: {
    includeCategories: true,
    includeGroups: true,
    includeFolders: false,
    compactFolders: true,
    excludeReferences: true,
  },
  // Organization
  categorizeByGroup: true,
  // Validation
  validation: {
    notDocumented: true,
  },
  // Other
  logLevel: 'Warn',
};

export default config;
