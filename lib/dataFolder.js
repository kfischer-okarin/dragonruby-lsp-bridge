const fsPromises = require('fs/promises');

exports.prepareDataFolder = async () => {
  await fsPromises.mkdir('.dragonruby-lsp-relay', { recursive: true });
};
