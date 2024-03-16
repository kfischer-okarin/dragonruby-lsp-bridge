const { buildLspMessageForwarder } = require('./lspMessageForwarder');

const forwarder = buildLspMessageForwarder();

process.stdin.on('data', async (data) => {
  forwarder.processIncomingData(data.toString());
});
