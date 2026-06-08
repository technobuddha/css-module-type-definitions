//@ts-check

/** @type import('\@technobuddha/project/build').Builds */
const config = {
  default: {
    steps: [
      {
        display: 'Prepare',
        command: ['rm -rf ./dist ./out', 'mkdir dist out'],
      },
      {
        display: 'CMTD',
        command: 'tsc --build src',
      },
      {
        display: 'package.json',
        command: './scripts/package-extension.ts',
      },
      {
        display: 'LICENSE',
        command: 'cp LICENSE.md out/LICENSE.md',
      },
      {
        display: 'README',
        command: 'cp README.md out/README.md',
      },
      {
        display: 'assets',
        command: 'cp assets/icon/cmtd.png assets/extension/.vscodeignore assets/extensions/* out',
      },
      {
        display: 'Webpack',
        command: 'webpack --mode=production',
      },
      {
        display: 'package',
        command: 'cd out && vsce package',
      }
    ],
  },
  compile: {
    steps: [
      { build: 'default' },
    ]
  },
  publish: {
    steps: [
      { build: 'default' },
      {
        display: 'Version',
        command: 'yarn version prerelease',
      },
      {
        display: 'Publish',
        command: 'yarn npm publish --access=public',
      }
    ]
  }
};

export default config;
