const assert = require('assert');
const test = require('node:test');
const {
  buildInitializeMessage,
  buildLSPMessage,
  buildRandomMessage,
  buildValidServerResponses,
  closeServer,
  isPortUsed,
  killProcess,
  sendToBridgeProcess,
  startStubServer,
  startBridgeProcess,
  tryToReadFromStream,
  waitUntilReceivedRequestCount,
} = require('./testHelpers.js');


let bridgeProcess;
let server;

test.before(async () => {
  const portIsUsed = await isPortUsed(9001);
  if (portIsUsed) {
    throw new Error('Port 9001 is already in use');
  }
});

test.afterEach(async () => {
  if (bridgeProcess) {
    await killProcess(bridgeProcess);
  }
  if (server && server.listening) {
    await closeServer(server);
  }
});

test('Forwards LSP requests to server', async () => {
  server = await startStubServer(9001, [
    { status: 200, body: '{"response": "ok"}' },
  ]);
  bridgeProcess = await startBridgeProcess();

  const response = await sendToBridgeProcess(bridgeProcess,
                                             'Content-Length: 23\r\n' +
                                             '\r\n' +
                                             '{"method":"initialize"}');

  assert.strictEqual(response,
                     'Content-Length: 18\r\n' +
                     '\r\n' +
                     '{"response": "ok"}');
  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method":"initialize"}' },
  ]);
});

test('Shows no output when server replies with 204', async () => {
  server = await startStubServer(9001, [
    ...buildValidServerResponses(1),
    { status: 204, body: '' },
  ]);
  bridgeProcess = await startBridgeProcess();
  await sendToBridgeProcess(bridgeProcess, buildInitializeMessage());

  const response = await sendToBridgeProcess(bridgeProcess, buildRandomMessage());

  assert.strictEqual(response, null);
});

test('Bridge process ignores messages while no server is started', async () => {
  bridgeProcess = await startBridgeProcess();
  await sendToBridgeProcess(bridgeProcess, buildLSPMessage('{"messageNumber": 1}'));

  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToBridgeProcess(bridgeProcess, buildLSPMessage('{"messageNumber": 2}'));

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"messageNumber": 2}' },
  ]);
});

test('Bridge process remembers initialize message until server starts', async () => {
  bridgeProcess = await startBridgeProcess();
  await sendToBridgeProcess(bridgeProcess, buildLSPMessage('{"method": "initialize"}'));

  server = await startStubServer(9001, [
    { status: 200, body: '{"result": {}}' },
  ]);
  await waitUntilReceivedRequestCount(server, 1);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method": "initialize"}' },
  ]);
});

// FLAKY
test('Bridge process sends same initialize message again when server restarts', async () => {
  bridgeProcess = await startBridgeProcess();
  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToBridgeProcess(bridgeProcess, buildLSPMessage('{"method": "initialize"}'));
  await closeServer(server);
  await sendToBridgeProcess(bridgeProcess, buildRandomMessage());
  // TODO: Wait for process state to change to "reconnecting"

  server = await startStubServer(9001, buildValidServerResponses(1));
  await waitUntilReceivedRequestCount(server, 1);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method": "initialize"}' },
  ]);
  const response = await tryToReadFromStream(bridgeProcess.stdout);
  // Don't deliver initialized response again
  assert.strictEqual(response, null);
});
