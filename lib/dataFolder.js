const fsPromises = require('fs/promises');

exports.prepareDataFolder = async () => {
  await fsPromises.mkdir('.dragonruby-lsp-relay', { recursive: true });
  // Prevent git from tracking the data folder
  await fsPromises.writeFile('.dragonruby-lsp-relay/.gitignore', '*');
};
