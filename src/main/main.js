const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

function resolveNativeBinary() {
  const extension = process.platform === "win32" ? ".exe" : "";
  return path.join(app.getAppPath(), "native", "bin", `hello_logs${extension}`);
}

function resolvePythonLaunch() {
  if (process.platform === "win32") {
    return { command: "py", prefixArgs: ["-3"] };
  }
  return { command: "python3", prefixArgs: [] };
}

function resolveCentralBankDbPath() {
  return path.join(app.getPath("userData"), "data", "central-bank-events.sqlite3");
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }

      resolve({ code, stdout, stderr, executedAt: new Date().toISOString() });
    });
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#f3f5f7",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

ipcMain.handle("native:run-hello", async () => {
  const binaryPath = resolveNativeBinary();

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Native binary not found at ${binaryPath}. Run npm run build:native first.`);
  }

  return runProcess(binaryPath, [], path.dirname(binaryPath));
});

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

ipcMain.handle("shell:open-external", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    throw new Error("Only http(s) urls can be opened.");
  }

  await shell.openExternal(url);
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
