const { fork } = require('child_process');
const http = require('http');

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

exports.closeServer = (server) => new Promise((resolve) => {
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

exports.startBridgeProcess = () => new Promise((resolve) => {
  const bridgeProcess = fork('./index.js', { stdio: ['pipe', 'pipe', 'inherit', 'ipc'] });
  bridgeProcess.on('spawn', () => {
    resolve(bridgeProcess);
  });
});

exports.sendToBridgeProcess = (bridgeProcess, message) => {
  bridgeProcess.stdin.write(message);
  return exports.tryToReadFromStream(bridgeProcess.stdout);
};

exports.killProcess = (process) => new Promise((resolve) => {
  process.on('exit', resolve);
  process.kill();
});

exports.waitForNextRequest = (server) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Timed out waiting for request'));
  }, 1000);

  server.once('request', (req) => {
    req.on('end', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
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
  }, 50);

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

exports.buildValidMessage = () => exports.buildLSPMessage('{"content":"hello"}');

exports.buildValidServerResponses = (numResponses) => {
  const responses = [];
  for (let i = 0; i < numResponses; i++) {
    responses.push({ status: 200, body: '{"response": "ok"}' });
  }
  return responses;
}
