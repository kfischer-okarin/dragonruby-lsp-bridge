const http = require('http');

let storedInitializeMessage = null;
let returnedInitializeResponse = false;

let collectedData = '';

process.stdin.on('data', async (data) => {
  collectedData += data;
  const message = extractNextJSONRPCMessage(collectedData);
  if (message) {
    if (isInitializeMessage(message.message)) {
      onNewEditorSessionHasStarted(message.message);
    }

    postJSONRPCMessageToServer(
      message.message,
      {
        onConnectionRefused: () => {
          if (storedInitializeMessage && !tryingToConnectToServer()) {
            tryToConnectToServer();
          }
        },
      },
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

const isInitializeMessage = (message) => {
  const parsedMessage = JSON.parse(message);
  return parsedMessage.method === 'initialize';
};


const onNewEditorSessionHasStarted = (initializeMessage) => {
  storedInitializeMessage = initializeMessage;
  returnedInitializeResponse = false;
};

const postJSONRPCMessageToServer = (message, { onConnectionRefused }) => postToServer(
  message,
  {
    onResponse: (response) => {
      if (response.status === 204) {
        return;
      }

      const wasInitializeMessage = isInitializeMessage(message);
      const shouldReturnResponse = !wasInitializeMessage || !returnedInitializeResponse;
      if (shouldReturnResponse) {
        process.stdout.write(
          `Content-Length: ${response.body.length}\r\n` +
            '\r\n' +
            response.body
        );

        if (wasInitializeMessage) {
          returnedInitializeResponse = true;
        }
      }
    },
    onError: (error) => {
      if (error.code === 'ECONNREFUSED' && onConnectionRefused) {
        onConnectionRefused();
        return;
      }
      throw error;
    },
  },
);

const postToServer = (requestBody, { onResponse, onError }) => {
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
  request.write(requestBody);
  request.end();
}

let tryInitializeMessageInterval = null;

const tryingToConnectToServer = () => tryInitializeMessageInterval !== null;

const tryToConnectToServer = () => {
  tryInitializeMessageInterval = setInterval(
    tryToSendInitializeMessage,
    500,
  );
};

const tryToSendInitializeMessage = () => {
  let success = true;
  postJSONRPCMessageToServer(
    storedInitializeMessage,
    {
      onConnectionRefused: () => {
        success = false;
      },
    },
  );

  if (success) {
    clearInterval(tryInitializeMessageInterval);
    tryInitializeMessageInterval = null;
  }
};
