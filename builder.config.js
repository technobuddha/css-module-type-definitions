//@ts-check

/** @type import('\@technobuddha/project/build').Builds */
const config = {
  default: {
    steps: [
      {
        display: 'Prepare',
        command: 'rm -rf ./dist'
      },
      {
        display: 'CMTD',
        command: 'tsc --build src',
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
