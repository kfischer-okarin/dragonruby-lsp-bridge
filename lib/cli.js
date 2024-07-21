const { parseArgs } = require('util');

exports.parseOptions = () => {
  const parseResult = parseArgs({
    options: {
      log: {
        type: 'boolean',
        default: false,
      },
    },
  });

  const options = {};

  if (parseResult.values.log) {
    options.logFileName = '.dragonruby-lsp-relay/session.log';
  }

  return options;
};
