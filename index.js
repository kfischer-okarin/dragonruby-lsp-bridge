const http = require('http');

let collectedData = '';

process.stdin.on('data', async (data) => {
  collectedData += data;
  const message = extractNextJSONRPCMessage(collectedData);
  if (message) {
    sendMessageToServer(
      message.message,
      {
        onResponse: (response) => {
          if (response.status === 204) {
            return;
          }

          process.stdout.write(
            `Content-Length: ${response.body.length}\r\n` +
              '\r\n' +
              response.body
          );
        },
        onError: (error) => {
          if (error.code === 'ECONNREFUSED') {
            return;
          }
          throw error;
        },
      }
    );
    collectedData = message.remaining;
  }
});

const extractNextJSONRPCMessage = (string) => {
  const headerMatch = string.match(/Content-Length: (\d+)\r\n\r\n/);
  if (!headerMatch) {
    return null;
  }

  const contentLength = parseInt(headerMatch[1], 10);
  const contentStart = headerMatch.index + headerMatch[0].length;
  const contentEnd = contentStart + contentLength;

  if (string.length < contentEnd) {
    return null;
  }

  return {
    message: string.slice(contentStart, contentEnd),
    remaining: string.slice(contentEnd),
  };
};

const sendMessageToServer = (message, { onResponse, onError }) => {
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
        onResponse({
          status: response.statusCode,
          body,
        });
      });
    }
  );

  request.on('error', onError);
  request.setHeader('Content-Type', 'application/json');
  request.write(message);
  request.end();
}
