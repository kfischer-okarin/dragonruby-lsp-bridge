const { buildLspMessageRelay } = require('./lspMessageRelay');

const relay = buildLspMessageRelay();

process.stdin.on('data', async (data) => {
  relay.processIncomingData(data.toString());
});
