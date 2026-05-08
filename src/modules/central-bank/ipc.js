const path = require("node:path");

function registerCentralBankIpc({ ipcMain, app, fs, resolveCentralBankDbPath, resolvePythonLaunch, runProcess }) {
  ipcMain.handle("data:get-central-bank-events", async (_event, options = {}) => {
    const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-central-bank-data.py");
    const dbPath = resolveCentralBankDbPath();
    const dbDirectory = path.dirname(dbPath);
    const { command, prefixArgs } = resolvePythonLaunch();

    fs.mkdirSync(dbDirectory, { recursive: true });

    const args = [...prefixArgs, scriptPath, "--db", dbPath];
    if (options?.refresh) {
      args.push("--refresh");
    }

    const result = await runProcess(command, args, app.getAppPath());
    return JSON.parse(result.stdout);
  });
}

module.exports = {
  registerCentralBankIpc,
};
