const { fork } = require('child_process');
const events = require('events');
const fsPromise = require('fs/promises');
const http = require('http');
const test = require('node:test');

// Node 18.17.1 has still a buggy behaviour for stopping tests
// But I need to use 18.17.1 since that is the version that VS Code uses (as of January 2024)
if (process.version !== 'v18.17.1') {
  process.emitWarning('Check if you can remove the defaultMaxListeners override');
}
events.EventEmitter.defaultMaxListeners = 1000;

exports.ensureAllPromisesAreResolvedEveryTest = () => {
  let keepTestAliveInterval;

  test.beforeEach(() => {
    keepTestAliveInterval = setInterval(() => {}, 1000);
  });

  test.afterEach(() => {
    clearInterval(keepTestAliveInterval);
  });
};

exports.readFile = (path) => fsPromise.readFile(path, 'utf8');

exports.waitUntilFileHasContent = async (path, content) => {
  let retries = 0;
  while (retries < 10) {
    try {
      const fileContent = await exports.readFile(path);
      if (fileContent === content) {
        return;
      }
    } catch {
      // File doesn't exist yet
    }
    retries++;
    await exports.waitForMs(100);
  }

  if (!await exports.fileExists(path)) {
    throw new Error(`File ${path} never appeared`);
  }
  const actualContent = await exports.readFile(path);
  throw new Error(`File ${path} never had content ${content}. Actual content: ${actualContent}`);
};

exports.fileExists = async (path) => {
  try {
    await fsPromise.access(path);
    return true;
  } catch {
    return false;
  }
};

exports.startStubServer = (port, responses) => new Promise((resolve) => {
  const server = http.createServer();

  server.receivedRequests = [];

  const remainingResponses = [...responses];

  server.on('request', (req, res) => {
    const bodyChunks = [];

    req.on('data', (chunk) => {
      bodyChunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(bodyChunks).toString();
      server.receivedRequests.push({
        url: req.url,
        method: req.method,
        body,
      });

      const response = remainingResponses.shift();
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(response.body);
      if (remainingResponses.length === 0) {
        server.close();
      }
    });
  });

  server.on('listening', () => {
    resolve(server);
  });

  server.listen(port, 'localhost');
});

exports.closeServerIfNecessary = (server) => new Promise((resolve) => {
  if (!server.listening) {
    resolve();
    return;
  }
  server.close(resolve);
});

exports.isPortUsed = (port) => new Promise((resolve) => {
  const request = http.request(
    `http://localhost:${port}`,
    { method: 'GET' },
    (response) => {
      resolve(true);
    }
  );
  request.on('error', () => {
    resolve(false);
  });
  request.end();
});

exports.startRelayProcess = () => new Promise((resolve) => {
  const relayProcess = fork('./index.js', { stdio: ['pipe', 'pipe', 'inherit', 'ipc'] });
  relayProcess.on('spawn', () => {
    resolve(relayProcess);
  });
});

exports.sendToRelayProcess = (relayProcess, message) => {
  relayProcess.stdin.write(message);
  return exports.tryToReadFromStream(relayProcess.stdout);
};

exports.waitUntilRelayProcessHasState = (state) => exports.waitUntilFileHasContent(
  '.lsp-dragonruby-relay-state',
  state
);

exports.killProcessIfNecessary = (process) => new Promise((resolve) => {
  if (process.killed || process.exitCode !== null) {
    resolve();
    return;
  }
  process.on('exit', resolve);
  process.kill();
});

exports.waitUntilReceivedRequestCount = (server, count) => new Promise((resolve, reject) => {
  let retries = 0;
  const interval = setInterval(() => {
    if (server.receivedRequests.length >= count) {
      clearInterval(interval);
      resolve();
      return;
    }
    retries++;

    if (retries > 10) {
      clearInterval(interval);
      reject(
        new Error(`Timed out waiting for ${count} requests.\nReceived:\n${JSON.stringify(server.receivedRequests)}`)
      );
    }
  }, 100);
});

exports.tryToReadFromStream = (stream) => new Promise((resolve) => {
  let readAndResolve;

  const readTimeout = setTimeout(() => {
    resolve(null);
    // Already resolved, so we don't want to resolve again on unrelated later reads
    stream.removeListener('readable', readAndResolve);
  }, 100);

  readAndResolve = () => {
    clearTimeout(readTimeout);
    resolve(stream.read().toString());
  };

  stream.once('readable', readAndResolve);
});

exports.waitForMs = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

exports.buildLSPMessage = (content) => (
  `Content-Length: ${content.length}\r\n` +
    '\r\n' +
    content
);

exports.buildInitializeMessage = () => exports.buildLSPMessage(`{"method":"initialize", "id": ${Math.random()}}`);

exports.buildRandomMessage = () => exports.buildLSPMessage(`{"content":"${Math.random()}"}`);

exports.buildValidServerResponses = (numResponses) => {
  const responses = [];
  for (let i = 0; i < numResponses; i++) {
    responses.push({ status: 200, body: '{"response": "ok"}' });
  }
  return responses;
}
