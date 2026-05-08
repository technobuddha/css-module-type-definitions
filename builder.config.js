//@ts-check

/** @type {import('@technobuddha/project/build').Builds} */
const config = {
  default: {
    steps: [
      {
        display: 'Clean',
        command: 'rm -rf ./dist',
      },
      {
        display: 'Library',
        command: 'npx tsc -p ./src',
      },
    ],
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
      },
    ],
  },
};

export default config;
