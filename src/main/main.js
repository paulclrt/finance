const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, Menu, shell, safeStorage } = require("electron");
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

function resolveCredentialsDbPath() {
  return path.join(app.getPath("userData"), "data", "credentials.sqlite3");
}

function runProcess(command, args, cwd) {
  return runProcessWithEnv(command, args, cwd);
}

function runProcessWithEnv(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
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

async function runCredentialsStore(args) {
  const { command, prefixArgs } = resolvePythonLaunch();
  const scriptPath = path.join(app.getAppPath(), "scripts", "credentials-store.py");
  return runProcess(command, [...prefixArgs, scriptPath, ...args], app.getAppPath());
}

async function getDecryptedCredential(serviceKey) {
  const result = await runCredentialsStore(["get", "--db", resolveCredentialsDbPath(), "--service-key", serviceKey]);
  const payload = JSON.parse(result.stdout);
  if (!payload) {
    return null;
  }
  return {
    serviceKey: payload.serviceKey,
    label: payload.label,
    credentialType: payload.credentialType,
    email: decryptField(payload.emailEncrypted),
    password: decryptField(payload.passwordEncrypted),
    apiKey: decryptField(payload.apiKeyEncrypted),
    notes: decryptField(payload.notesEncrypted),
    updatedAt: payload.updatedAt,
  };
}

function encryptField(value) {
  if (!value) {
    return "";
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system.");
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decryptField(value) {
  if (!value) {
    return "";
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system.");
  }
  return safeStorage.decryptString(Buffer.from(value, "base64"));
}

function buildAppMenu(mainWindow) {
  const template = [];

  if (process.platform === "darwin") {
    template.push({ role: "appMenu" });
  }

  template.push({
    label: "Settings",
    submenu: [
      {
        label: "Credentials",
        accelerator: "CmdOrCtrl+,",
        click: () => {
          mainWindow.webContents.send("ui:open-credentials");
        },
      },
    ],
  });

  template.push({
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
    ],
  });

  if (process.platform !== "darwin") {
    template.push({
      label: "File",
      submenu: [{ role: "quit" }],
    });
  }

  return Menu.buildFromTemplate(template);
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#f3f5f7",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  Menu.setApplicationMenu(buildAppMenu(window));
  return window;
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

ipcMain.handle("data:get-inflation-data", async (_event, options = {}) => {
  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-inflation-data.py");
  const dbPath = path.join(app.getPath("userData"), "data", "inflation.sqlite3");
  const dbDirectory = path.dirname(dbPath);
  const { command, prefixArgs } = resolvePythonLaunch();
  const credential =
    (await getDecryptedCredential("fredapikey")) ||
    (await getDecryptedCredential("fred")) ||
    (await getDecryptedCredential("FRED"));

  const apiKey = String(credential?.apiKey || credential?.password || "").trim();
  if (!apiKey) {
    throw new Error("Missing FRED API key. Save it in Settings > Credentials under service key 'fredapikey'.");
  }

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

ipcMain.handle("credentials:status", async () => {
  return {
    secureStorageAvailable: safeStorage.isEncryptionAvailable(),
    dbPath: resolveCredentialsDbPath(),
  };
});

ipcMain.handle("credentials:list", async () => {
  const result = await runCredentialsStore(["list", "--db", resolveCredentialsDbPath()]);
  return JSON.parse(result.stdout);
});

ipcMain.handle("credentials:get", async (_event, serviceKey) => {
  return getDecryptedCredential(serviceKey);
});

ipcMain.handle("credentials:save", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid credential payload.");
  }

  const serviceKey = String(payload.serviceKey || "").trim();
  const label = String(payload.label || "").trim();
  const credentialType = String(payload.credentialType || "").trim();
  if (!serviceKey || !label) {
    throw new Error("Service key and label are required.");
  }
  if (!["api_key", "email_password"].includes(credentialType)) {
    throw new Error("Credential type is required.");
  }

  await runCredentialsStore([
    "upsert",
    "--db",
    resolveCredentialsDbPath(),
    "--service-key",
    serviceKey,
    "--label",
    label,
    "--credential-type",
    credentialType,
    "--email",
    encryptField(String(payload.email || "")),
    "--password",
    encryptField(String(payload.password || "")),
    "--api-key",
    encryptField(String(payload.apiKey || "")),
    "--notes",
    encryptField(String(payload.notes || "")),
  ]);

  return { stored: true };
});

ipcMain.handle("credentials:delete", async (_event, serviceKey) => {
  const normalizedServiceKey = String(serviceKey || "").trim();
  if (!normalizedServiceKey) {
    throw new Error("Service key is required.");
  }

  const result = await runCredentialsStore([
    "delete",
    "--db",
    resolveCredentialsDbPath(),
    "--service-key",
    normalizedServiceKey,
  ]);

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
