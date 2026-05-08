const path = require("node:path");

function registerRiskIpc({
  ipcMain,
  app,
  fs,
  resolveRiskDbPath,
  resolvePythonLaunch,
  runProcessWithEnv,
  getFredApiKey,
}) {
  ipcMain.handle("data:get-risk-data", async (_event, options = {}) => {
    const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-risk-data.py");
    const dbPath = resolveRiskDbPath();
    const dbDirectory = path.dirname(dbPath);
    const { command, prefixArgs } = resolvePythonLaunch();
    const apiKey = await getFredApiKey();

    fs.mkdirSync(dbDirectory, { recursive: true });

    const args = [...prefixArgs, scriptPath, "--db", dbPath];
    if (options?.refresh) {
      args.push("--refresh");
    }
    if (options?.years) {
      args.push("--years", String(options.years));
    }

    const result = await runProcessWithEnv(command, args, app.getAppPath(), {
      FRED_API_KEY: apiKey,
    });
    return JSON.parse(result.stdout);
  });
}

module.exports = {
  registerRiskIpc,
};
