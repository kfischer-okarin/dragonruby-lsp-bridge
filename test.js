const assert = require('assert');
const test = require('node:test');
const {
  buildInitializeMessage,
  buildLSPMessage,
  buildRandomMessage,
  buildValidServerResponses,
  closeServerIfNecessary,
  ensureAllPromisesAreResolvedEveryTest,
  fileExists,
  isPortUsed,
  killProcessIfNecessary,
  sendToRelayProcess,
  startRelayProcess,
  startStubServer,
  tryToReadFromStream,
  waitUntilFileHasContent,
  waitUntilReceivedRequestCount,
} = require('./testHelpers.js');


ensureAllPromisesAreResolvedEveryTest();

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
    await killProcessIfNecessary(relayProcess);
  }
  if (server) {
    await closeServerIfNecessary(server);
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

test("Enters state 'waitingForEditor' before first message", async () => {
  relayProcess = await startRelayProcess();
  await waitUntilFileHasContent('.lsp-dragonruby-relay-state', 'waitingForEditor');
});

test("Enters state 'connectingToServer' after initialize message", async () => {
  relayProcess = await startRelayProcess();
  await sendToRelayProcess(relayProcess, buildInitializeMessage());
  await waitUntilFileHasContent('.lsp-dragonruby-relay-state', 'connectingToServer');
});

test("Enters state 'connectedToServer' after server responds to initialize message", async () => {
  relayProcess = await startRelayProcess();
  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToRelayProcess(relayProcess, buildInitializeMessage());
  await waitUntilFileHasContent('.lsp-dragonruby-relay-state', 'connectedToServer');
});

test("Enters state 'reconnectingToServer' after server connection is lost", async () => {
  relayProcess = await startRelayProcess();
  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToRelayProcess(relayProcess, buildInitializeMessage());
  await closeServerIfNecessary(server);
  await sendToRelayProcess(relayProcess, buildRandomMessage());
  await waitUntilFileHasContent('.lsp-dragonruby-relay-state', 'reconnectingToServer');
});

test('Removes state file after process ends', async () => {
  relayProcess = await startRelayProcess();
  await killProcessIfNecessary(relayProcess);
  const stateFileExists = await fileExists('.lsp-dragonruby-relay-state');
  assert.strictEqual(stateFileExists, false, 'State file should not exist but does');
});

test('Sends same initialize message again when server restarts', async () => {
  relayProcess = await startRelayProcess();
  server = await startStubServer(9001, buildValidServerResponses(1));
  await sendToRelayProcess(relayProcess, buildLSPMessage('{"method": "initialize"}'));
  await closeServerIfNecessary(server);
  await sendToRelayProcess(relayProcess, buildRandomMessage());
  await waitUntilFileHasContent('.lsp-dragonruby-relay-state', 'reconnectingToServer');

  server = await startStubServer(9001, buildValidServerResponses(1));
  await waitUntilReceivedRequestCount(server, 1);

  assert.deepStrictEqual(server.receivedRequests, [
    { method: 'POST', url: '/dragon/lsp', body: '{"method": "initialize"}' },
  ]);
  const response = await tryToReadFromStream(relayProcess.stdout);
  // Don't deliver initialized response again
  assert.strictEqual(response, null);
});
