const { mkdir, writeFile } = require('fs/promises');
const path = require('path');

const DATA_FOLDER_NAME = '.lsp-http-relay';

exports.prepareDataFolder = async () => {
  await mkdir(DATA_FOLDER_NAME, { recursive: true });
  // Prevent git from tracking the data folder
  await writeFile(exports.fileInDataFolder('.gitignore'), '*');
};

exports.fileInDataFolder = (filename) => path.join(DATA_FOLDER_NAME, filename);
