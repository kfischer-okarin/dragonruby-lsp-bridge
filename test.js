const assert = require('assert');
const { startStubServer, startBridgeProcess, waitForNextRequest, readStringSync } = require('./testHelpers.js');


(async () => {
  const server = startStubServer(9001, ['{"response": "ok"}']);
  const bridgeProcess = startBridgeProcess();
  bridgeProcess.stdin.write('Content-Length: 19\r\n' +
                            '\r\n' +
                            '{"content":"hello"}');

  await waitForNextRequest(server);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', body: '{"content":"hello"}' },
  ]);

  const response = await readStringSync(bridgeProcess.stdout);

  assert.strictEqual(response,
                     'Content-Length: 18\r\n' +
                     '\r\n' +
                     '{"response": "ok"}');

  bridgeProcess.kill();
})();
