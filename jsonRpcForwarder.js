const http = require('http');

exports.buildJsonRpcForwarder = () => new JsonRpcForwarder();

class JsonRpcForwarder {
  constructor() {
    this.storedInitializeMessage = null;
    this.initializationState = {
      type: 'waitingForInitialize',
    };
    this.returnedInitializeResponse = false;
    this.tryInitializeMessageInterval = null;
    this.messageStreamReader = new JSONRPCMessageStreamReader();
  }

  async processIncomingData(data) {
    this.messageStreamReader.processIncomingData(data);

    while (this.messageStreamReader.hasReadyMessages) {
      const message = this.messageStreamReader.takeNextReadyMessage();

      this.processMessage(message);

      await this.postJSONRPCMessageToServer(
        message,
        {
          onConnectionRefused: () => {
            if (this.storedInitializeMessage && !this.tryingToConnectToServer) {
              this.tryToConnectToServer();
            }
          },
        },
      );
    }
  }

  processMessage(message) {
    if (isInitializeMessage(message)) {
      this.storedInitializeMessage = message;
      this.returnedInitializeResponse = false;
    }
  }

  async postJSONRPCMessageToServer(message, { onConnectionRefused }) {
    try {
      const response = await postToURL('http://localhost:9001/dragon/lsp', message.raw);

      if (response.status === 204) {
        return;
      }

      const shouldReturnResponse = !isInitializeMessage(message) || !this.returnedInitializeResponse;
      if (shouldReturnResponse) {
        process.stdout.write(
          `Content-Length: ${response.body.length}\r\n` +
            '\r\n' +
            response.body
        );

        if (isInitializeMessage(message)) {
          this.returnedInitializeResponse = true;
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED' && onConnectionRefused) {
        onConnectionRefused();
        return;
      }
      throw error;
    }
  }

  get tryingToConnectToServer() {
    return this.tryInitializeMessageInterval !== null;
  }

  tryToConnectToServer() {
    this.tryInitializeMessageInterval = setInterval(
      tryToSendInitializeMessage,
      500,
      this
    );
  };

  stopConnectingToServer() {
    clearInterval(this.tryInitializeMessageInterval);
    this.tryInitializeMessageInterval = null;
  }
}

// --- private functions ---

class JSONRPCMessageStreamReader {
  #collectedData;
  #readyMessages;

  constructor() {
    this.#collectedData = '';
    this.#readyMessages = [];
  }

  get hasReadyMessages() {
    return this.#readyMessages.length > 0;
  }

  takeNextReadyMessage() {
    return this.#readyMessages.shift();
  }

  processIncomingData(data) {
    this.#collectedData += data;

    let message = this.#tryToReadJSONRPCMessage();
    while (message) {
      this.#readyMessages.push(message);
      message = this.#tryToReadJSONRPCMessage();
    }
  }

  #tryToReadJSONRPCMessage() {
    const headerMatch = this.#collectedData.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) {
      return null;
    }

    const contentLength = parseInt(headerMatch[1], 10);
    const contentStart = headerMatch.index + headerMatch[0].length;
    const contentEnd = contentStart + contentLength;

    if (this.#collectedData.length < contentEnd) {
      return null;
    }

    const rawMessage = this.#collectedData.slice(contentStart, contentEnd);

    this.#collectedData = this.#collectedData.slice(contentEnd);

    return {
      raw: rawMessage,
      parsed: JSON.parse(rawMessage),
    };
  };
}

const isInitializeMessage = (message) => message && message.parsed && message.parsed.method === 'initialize';

const postToURL = (url, requestBody) => new Promise((resolve, reject) => {
  const request = http.request(
    url,
    { method: 'POST' },
    (response) => {
      const bodyChunks = [];

      response.on('data', (chunk) => {
        bodyChunks.push(chunk);
      });

      response.on('end', () => {
        const body = Buffer.concat(bodyChunks).toString();
        resolve({
          status: response.statusCode,
          body,
        });
      });
    }
  );

  request.on('error', reject);
  request.setHeader('Content-Type', 'application/json');
  request.write(requestBody);
  request.end();
});

const tryToSendInitializeMessage = async (forwarder) => {
  let success = true;
  await forwarder.postJSONRPCMessageToServer(
    forwarder.storedInitializeMessage,
    {
      onConnectionRefused: () => {
        success = false;
      },
    },
  );

  if (success) {
    forwarder.stopConnectingToServer();
  }
};
