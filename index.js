const { buildLspMessageRelay } = require('./lib/lspMessageRelay');

const options = {};
const args = process.argv.slice(2);
let flag;

while (args.length > 0) {
  const nextArg = args.shift();
  switch (flag) {
  case 'log':
    options.logFileName = nextArg;
    flag = null;
    break;
  default:
    if (nextArg === '--log') {
      flag = 'log';
    } else {
      throw new Error(`Unknown option: ${nextArg}`);
    }
    break;
  }
}

const relay = buildLspMessageRelay(options);

process.stdin.on('data', async (data) => {
  relay.processIncomingData(data.toString());
});

process.on('SIGTERM', () => {
  relay.shutdown();
  process.exit(0);
});
