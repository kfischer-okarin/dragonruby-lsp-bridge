exports.parseOptions = (argv) => {
  const options = {};
  const args = argv.slice(2);
  let flag;

  while (args.length > 0) {
    const nextArg = args.shift();
    switch (flag) {
    default:
      if (nextArg === '--log') {
        options.logFileName = '.dragonruby-lsp-relay/session.log';
      } else {
        throw new Error(`Unknown option: ${nextArg}`);
      }
      break;
    }
  }

  return options;
}
