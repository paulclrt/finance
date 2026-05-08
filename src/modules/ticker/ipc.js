const path = require("node:path");

function registerTickerIpc({ ipcMain, app, fs, resolvePythonLaunch, runProcess }) {
  ipcMain.handle("data:get-ticker-data", async (_event, options = {}) => {
    const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-ticker.py");
    const dbPath = path.join(app.getPath("userData"), "data", "ticker.sqlite3");
    const dbDirectory = path.dirname(dbPath);
    const { command, prefixArgs } = resolvePythonLaunch();

    fs.mkdirSync(dbDirectory, { recursive: true });

    const args = [
      ...prefixArgs,
      scriptPath,
      "--db",
      dbPath,
      "--ticker",
      options.ticker || "AAPL",
      "--duration",
      options.duration || "1mo",
    ];
    if (options?.refresh) {
      args.push("--refresh");
    }

    const result = await runProcess(command, args, app.getAppPath());
    return JSON.parse(result.stdout);
  });
}

module.exports = {
  registerTickerIpc,
};
