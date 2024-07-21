const { parseOptions } = require('./lib/cli');
const { prepareDataFolder } = require('./lib/dataFolder');
const { buildLspMessageRelay } = require('./lib/lspMessageRelay');

const main = async () => {
  const options = parseOptions();

  await prepareDataFolder();

  const relay = buildLspMessageRelay(options);

  process.stdin.on('data', async (data) => {
    relay.processIncomingData(data.toString());
  });

  process.on('SIGTERM', () => {
    relay.shutdown();
    process.exit(0);
  });
};

main();
