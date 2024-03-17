const { parseOptions } = require('./lib/cli');
const { buildLspMessageRelay } = require('./lib/lspMessageRelay');

const options = parseOptions(process.argv);
const relay = buildLspMessageRelay(options);

process.stdin.on('data', async (data) => {
  relay.processIncomingData(data.toString());
});

process.on('SIGTERM', () => {
  relay.shutdown();
  process.exit(0);
});
