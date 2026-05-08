const path = require("node:path");

function registerFilesystemIpc({ ipcMain, fs }) {
  ipcMain.handle("fs:check-file-exists", async (_event, filePath) => {
    const sourceFile = path.join(__dirname, "..", "..", "renderer", filePath);
    return fs.existsSync(sourceFile);
  });
}

module.exports = {
  registerFilesystemIpc,
};
