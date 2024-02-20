const { fork } = require('child_process');
const http = require('http');


exports.startStubServer = (port, responses) => {
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

  server.listen(port, 'localhost');

  return server;
}

exports.startBridgeProcess = () => fork('./index.js', { stdio: ['pipe', 'pipe', 'inherit', 'ipc'] });

exports.waitForNextRequest = (server) => new Promise((resolve) => {
  server.once('request', (req) => {
    req.on('end', resolve);
  });
});

exports.readStringSync = (stream) => new Promise((resolve) => {
  stream.once('readable', () => {
    resolve(stream.read().toString());
  });
});

exports.buildValidMessage = () => (
  'Content-Length: 19\r\n' +
  '\r\n' +
    '{"content":"hello"}'
);
