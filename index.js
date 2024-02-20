const http = require('http');

let collectedData = '';

process.stdin.on('data', async (data) => {
  collectedData += data;
  const message = findNextJSONRPCMessage(collectedData);
  if (message) {
    sendMessageToServer(message.message, (response) => {
      process.stdout.write(
        `Content-Length: ${response.length}\r\n` +
        '\r\n' +
        response
      );
    });
    collectedData = message.remaining;
  }
});

const findNextJSONRPCMessage = (string) => {
  const contentLengthMatch = string.match(/Content-Length: (\d+)/);
  if (!contentLengthMatch) {
    return null;
  }

  const contentLength = parseInt(contentLengthMatch[1], 10);
  const contentStart = string.indexOf('\r\n\r\n') + 4;
  const contentEnd = contentStart + contentLength;

  if (string.length < contentEnd) {
    return null;
  }

  return {
    message: string.slice(contentStart, contentEnd),
    remaining: string.slice(contentEnd),
  };
};

const sendMessageToServer = (message, processResponseCallback) => {
  const request = http.request(
    'http://localhost:9001',
    { method: 'POST' },
    (response) => {
      const bodyChunks = [];

      response.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });

      response.on('end', () => {
        const body = Buffer.concat(bodyChunks).toString();
        processResponseCallback(body);
      });
    }
  );
  request.setHeader('Content-Type', 'application/json');
  request.write(message);
  request.end();
}
