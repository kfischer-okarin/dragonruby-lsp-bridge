const assert = require('assert');
const test = require('node:test');
const {
  buildJSONRPCMessage,
  buildValidMessage,
  buildValidServerResponses,
  readStringSync,
  startStubServer,
  startBridgeProcess,
  waitForMs,
  waitForNextRequest,
} = require('./testHelpers.js');


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

test('Shows no output when server replies with 204', async () => {
  const server = startStubServer(9001, [
    { status: 204, body: '' },
    { status: 200, body: '{"response": "ok"}' },
  ]);
  bridgeProcess = startBridgeProcess();

  bridgeProcess.stdin.write(buildValidMessage());
  await waitForNextRequest(server);
  bridgeProcess.stdin.write(buildValidMessage());
  await waitForNextRequest(server);

  const response = await readStringSync(bridgeProcess.stdout);
  assert.strictEqual(response,
                     'Content-Length: 18\r\n' +
                     '\r\n' +
                     '{"response": "ok"}');
});

test('Bridge process ignores messages while no server is started', async () => {
  bridgeProcess = startBridgeProcess();
  bridgeProcess.stdin.write(buildJSONRPCMessage('{"messageNumber": 1}'));
  // Make sure the stdin handler has time to process the message
  await waitForMs(50);

  const server = startStubServer(9001, buildValidServerResponses(1));
  bridgeProcess.stdin.write(buildJSONRPCMessage('{"messageNumber": 2}'));

  await waitForNextRequest(server);
  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', body: '{"messageNumber": 2}' },
  ]);
});
