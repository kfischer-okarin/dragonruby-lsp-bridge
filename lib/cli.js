exports.parseOptions = (argv) => {
  const options = {};
  const args = argv.slice(2);
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

  return options;
}
