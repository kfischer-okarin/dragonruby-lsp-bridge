const fs = require('fs');
const http = require('http');

exports.buildLspMessageRelay = (options) => new LspMessageRelay(options);

class LspMessageRelay {
  STATE_FILE_PATH = '.dragonruby-lsp-relay/state';

  #messageStreamReader;
  #logFileName;

  constructor(options = {}) {
    this.#logFileName = options.logFileName;
    if (this.#logFileName) {
      fs.writeFileSync(this.#logFileName, '');
    }
    this.#messageStreamReader = new LspMessageStreamReader();
    this.#waitForEditor();
  }

  async processIncomingData(data) {
    this.#messageStreamReader.processIncomingData(data);

    while (this.#messageStreamReader.hasReadyMessages) {
      const message = this.#messageStreamReader.takeNextReadyMessage();

      this.#processMessage(message);

      await this.#postLspMessageToServer(
        message,
        {
          onConnectionRefused: () => {
            if (this.#state.connectedToServer) {
              this.#startReconnectingToServer();
            }
          },
        },
      );
    }
  }

  postInitializeMessageToServer() {
    this.#postLspMessageToServer(
      this.#state.initializeMessage,
      { onConnectionRefused: () => {} },
    );
  }

  shutdown() {
    if (this.#state.connectInterval) {
      clearInterval(this.#state.connectInterval);
    }
    fs.unlinkSync(this.STATE_FILE_PATH);
  }

  #processMessage(message) {
    if (this.#state.waitingForEditor && isInitializeMessage(message)) {
      this.#startConnectingToServer(message);
    }

    if (this.#logFileName) {
      this.#log(`request ${message.raw}`);
    }
  }

  async #postLspMessageToServer(message, { onConnectionRefused }) {
    try {
      const response = await postToURL('http://localhost:9001/dragon/lsp', message.raw);

      if (response.status === 204) {
        return;
      }

      const shouldReturnResponse = this.#state.connectingToServer || this.#state.connectedToServer;
      if (shouldReturnResponse) {
        process.stdout.write(
          `Content-Length: ${response.body.length}\r\n` +
            '\r\n' +
            response.body
        );

        if (this.#logFileName) {
          this.#log(`response ${response.body}`);
        }
      }

      if (this.#state.connectingToServer) {
        this.#startForwardingMessages();
      }
    } catch (error) {
      const isConnectionRefusedError = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET';
      if (isConnectionRefusedError && onConnectionRefused) {
        onConnectionRefused();
        return;
      }
      throw error;
    }
  }

  // --- state management ---
  #state;

  #waitForEditor() {
    this.#state = { waitingForEditor: true };
    this.#writeStateToFile('waitingForEditor');
  }

  #startConnectingToServer(initializeMessage) {
    this.#state = {
      connectingToServer: true,
      initializeMessage,
      connectInterval: setInterval(
        tryToSendInitializeMessage,
        500,
        this,
      ),
    };
    this.#writeStateToFile('connectingToServer');
  }

  #startForwardingMessages() {
    if (this.#state.connectInterval) {
      clearInterval(this.#state.connectInterval);
    }

    this.#state = {
      connectedToServer: true,
      initializeMessage: this.#state.initializeMessage
    };
    this.#writeStateToFile('connectedToServer');
  }

  #startReconnectingToServer() {
    this.#state = {
      reconnectingToServer: true,
      initializeMessage: this.#state.initializeMessage,
      connectInterval: setInterval(
        tryToSendInitializeMessage,
        500,
        this,
      ),
    };
    this.#writeStateToFile('reconnectingToServer');
  }

  #writeStateToFile(state) {
    fs.writeFileSync(this.STATE_FILE_PATH, state);
    if (this.#logFileName) {
      this.#log(`state ${state}`);
    }
  }

  #log(message) {
    fs.appendFileSync(this.#logFileName, `${new Date().toISOString()} ${message}\n`);
  }
}

// --- private functions ---

class LspMessageStreamReader {
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

    let message = this.#tryToConsumeLspMessage();
    while (message) {
      this.#readyMessages.push(message);
      message = this.#tryToConsumeLspMessage();
    }
  }

  #tryToConsumeLspMessage() {
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
  request.setHeader('Content-Length', requestBody.length);
  request.write(requestBody);
  request.end();
});

const tryToSendInitializeMessage = async (forwarder) => {
  forwarder.postInitializeMessageToServer();
};
