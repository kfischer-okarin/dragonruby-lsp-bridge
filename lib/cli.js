const { parseArgs } = require('util');

const { fileInDataFolder } = require('./dataFolder');

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
    options.logFileName = fileInDataFolder('session.log');
  }

  return options;
};
