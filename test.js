const assert = require('assert');
const { startStubServer, startBridgeProcess, waitForNextRequest, readStringSync } = require('./testHelpers.js');


(async () => {
  const server = startStubServer(9001, ['{"response": "ok"}']);
  const bridgeProcess = startBridgeProcess();
  bridgeProcess.stdin.write('{"content": "hello"}');

  await waitForNextRequest(server);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', body: '{"content": "hello"}' },
  ]);

  const response = await readStringSync(bridgeProcess.stdout);

  assert.strictEqual(response, '{"response": "ok"}');

  bridgeProcess.kill();
})();
