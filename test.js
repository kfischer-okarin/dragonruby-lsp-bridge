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
  sendToRelayProcess,
  startRelayProcess,
  startStubServer,
  tryToReadFromStream,
  waitUntilReceivedRequestCount,
} = require('./testHelpers.js');


let relayProcess;
let server;

test.before(async () => {
  const portIsUsed = await isPortUsed(9001);
  if (portIsUsed) {
    throw new Error('Port 9001 is already in use');
  }
});

test.afterEach(async () => {
  if (relayProcess) {
    await killProcess(relayProcess);
  }
  if (server && server.listening) {
    await closeServer(server);
  }
});

test('Relays LSP requests to server and responses from server', async () => {
  server = await startStubServer(9001, [
    { status: 200, body: '{"response": "ok"}' },
  ]);
  relayProcess = await startRelayProcess();

  const response = await sendToRelayProcess(relayProcess,
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
  relayProcess = await startRelayProcess();
  await sendToRelayProcess(relayProcess, buildInitializeMessage());

  const response = await sendToRelayProcess(relayProcess, buildRandomMessage());

  assert.strictEqual(response, null);
});

test('Ignores messages while no server is started', async () => {
  relayProcess = await startRelayProcess();
  await sendToRelayProcess(relayProcess, buildLSPMessage('{"messageNumber": 1}'));

  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToRelayProcess(relayProcess, buildLSPMessage('{"messageNumber": 2}'));

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"messageNumber": 2}' },
  ]);
});

test('Remembers initialize message until server starts', async () => {
  relayProcess = await startRelayProcess();
  await sendToRelayProcess(relayProcess, buildLSPMessage('{"method": "initialize"}'));

  server = await startStubServer(9001, [
    { status: 200, body: '{"result": {}}' },
  ]);
  await waitUntilReceivedRequestCount(server, 1);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method": "initialize"}' },
  ]);
});

// FLAKY
test('Sends same initialize message again when server restarts', async () => {
  relayProcess = await startRelayProcess();
  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToRelayProcess(relayProcess, buildLSPMessage('{"method": "initialize"}'));
  await closeServer(server);
  await sendToRelayProcess(relayProcess, buildRandomMessage());
  // TODO: Wait for process state to change to "reconnecting"

  server = await startStubServer(9001, buildValidServerResponses(1));
  await waitUntilReceivedRequestCount(server, 1);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method": "initialize"}' },
  ]);
  const response = await tryToReadFromStream(relayProcess.stdout);
  // Don't deliver initialized response again
  assert.strictEqual(response, null);
});
