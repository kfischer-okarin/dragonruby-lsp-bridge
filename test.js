const assert = require('assert');
const test = require('node:test');
const { startStubServer, startBridgeProcess, waitForNextRequest, readStringSync } = require('./testHelpers.js');


let bridgeProcess;


test.afterEach(() => {
  if (bridgeProcess) {
    bridgeProcess.kill();
  }
});

test('Forwards JSON RPC requests to server', async () => {
  const server = startStubServer(9001, [
    { status: 200, body: '{"response": "ok"}' },
  ]);
  bridgeProcess = startBridgeProcess();
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
});
