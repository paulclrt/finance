const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("node:child_process");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

function resolveNativeBinary() {
  const extension = process.platform === "win32" ? ".exe" : "";
  return path.join(app.getAppPath(), "native", "bin", `hello_logs${extension}`);
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#08111f",
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

  return await new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [], {
      cwd: path.dirname(binaryPath),
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
        reject(new Error(stderr || `Native process exited with code ${code}`));
        return;
      }

      resolve({
        code,
        stdout,
        stderr,
        executedAt: new Date().toISOString(),
      });
    });
  });
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
