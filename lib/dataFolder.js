const fsPromises = require('fs/promises');

exports.prepareDataFolder = async () => {
  await fsPromises.mkdir('.dragonruby-lsp-relay', { recursive: true });
  await fsPromises.writeFile('.dragonruby-lsp-relay/.gitignore', '*');
};
