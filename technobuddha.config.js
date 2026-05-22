//@ts-check
/** @type import("@technobuddha/project").TechnobuddhaConfig */
const config = {
  git: {
    ignore: [
      'out'
    ]
  },
  directories: {
    src: {
      platform: 'node',
    },
  },
  typedoc: {
    readme: 'doc/intro.md',
  },
  lint: {
    rules: {
      'unicorn/prefer-event-target': { rule: 'off' }
    }
  }
};

export default config;
