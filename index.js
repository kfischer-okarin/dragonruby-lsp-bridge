const { buildJsonRpcForwarder } = require('./jsonRpcForwarder');

const forwarder = buildJsonRpcForwarder();

process.stdin.on('data', async (data) => {
  forwarder.processIncomingData(data.toString());
});
