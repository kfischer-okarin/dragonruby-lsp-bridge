const { startStubServer } = require('./testHelpers.js');

startStubServer(9001, ['{"response": "ok"}']);
// startBridge
// sendRequestViaStdin
// checkReceivedRequests
// checkStdout
