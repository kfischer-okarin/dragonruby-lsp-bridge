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

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(remainingResponses.shift());
      if (remainingResponses.length === 0) {
        server.close();
      }
    });
  });

  server.listen(port, 'localhost');

  return server;
}
