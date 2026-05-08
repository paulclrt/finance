const path = require("node:path");

function registerNativeIpc({ ipcMain, fs, resolveNativeBinary, runProcess }) {
  ipcMain.handle("native:run-hello", async () => {
    const binaryPath = resolveNativeBinary();

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Native binary not found at ${binaryPath}. Run npm run build:native first.`);
    }

    return runProcess(binaryPath, [], path.dirname(binaryPath));
  });
}

module.exports = {
  registerNativeIpc,
};
