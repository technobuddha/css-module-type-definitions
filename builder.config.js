//@ts-check

/** @type import('\@technobuddha/project/build').Builds */
const config = {
  default: {
    steps: [
      { build: 'compile' },
      { build: 'bundle' },
    ]
  },
  compile: {
    steps: [
      {
        display: 'prepare',
        command: ['rm -rf ./dist ./out', 'mkdir dist out'],
      },
      {
        display: 'cmtd',
        command: 'tsc --build src',
      },
      {
        display: 'package.json',
        command: './scripts/package-extension.ts',
      },
      {
        display: 'assets',
        command: [
          'cp LICENSE.md out/LICENSE.md',
          'cp README.md out/README.md',
          'cp assets/icon/cmtd.png assets/extension/* out',
          'cp assets/icon/cmtd.png dist/vscode-extension'
        ],
      },
    ],
  },
  bundle: {
    steps: [
      {
        display: 'webpack',
        command: 'webpack --mode=production',
      },
      {
        display: 'install',
        command: 'cd out && npm install',
      },
      {
        display: 'vsix',
        command: 'cd out && vsce package',
      }
    ]
  },
  publish: {
    steps: [
      { build: 'compile' },
      {
        display: 'Version',
        command: 'yarn version prerelease',
      },
      {
        display: 'Publish',
        command: 'yarn npm publish --access=public',
      },
      { build: 'bundle' }
    ]
  }
};

export default config;
