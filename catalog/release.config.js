const config =
  require('@securustablets/libraries.semantic-release-config/yarn-monorepo-release')(
    {},
  );

// Print the rendered configuration to your console by running
// `yarn node release.config.js`
if (require.main === module) {
  console.log(require('js-yaml').dump(config).trimEnd());
}

module.exports = config;
