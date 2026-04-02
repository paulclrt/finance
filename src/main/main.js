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

function resolveConfigPath() {
  return path.join(app.getPath("userData"), "config", "app-state.xml");
}

let appConfigState = null;
let configWriteTimer = null;
let configWritePromise = null;

function getDefaultAppConfig() {
  return {
    window: {
      width: 1440,
      height: 960,
      x: null,
      y: null,
      isMaximized: false,
      isFullScreen: false,
    },
    layout: {
      leftWidth: 18,
      rightWidth: 20,
      bottomHeight: 38,
    },
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function parseTagAttributes(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}\\s+([^>]+?)\\s*\\/?>`, "i"));
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    [...match[1].matchAll(/([a-zA-Z0-9_:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
  );
}

function toFiniteNumber(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function readAppConfig() {
  if (appConfigState) {
    return appConfigState;
  }

  const defaults = getDefaultAppConfig();
  const configPath = resolveConfigPath();

  if (!fs.existsSync(configPath)) {
    appConfigState = defaults;
    return appConfigState;
  }

  try {
    const xml = fs.readFileSync(configPath, "utf8");
    const windowAttributes = parseTagAttributes(xml, "window");
    const layoutAttributes = parseTagAttributes(xml, "layout");

    appConfigState = {
      window: {
        width: toFiniteNumber(windowAttributes.width, defaults.window.width),
        height: toFiniteNumber(windowAttributes.height, defaults.window.height),
        x: windowAttributes.x != null ? toFiniteNumber(windowAttributes.x, defaults.window.x) : defaults.window.x,
        y: windowAttributes.y != null ? toFiniteNumber(windowAttributes.y, defaults.window.y) : defaults.window.y,
        isMaximized: toBoolean(windowAttributes.isMaximized, defaults.window.isMaximized),
        isFullScreen: toBoolean(windowAttributes.isFullScreen, defaults.window.isFullScreen),
      },
      layout: {
        leftWidth: toFiniteNumber(layoutAttributes.leftWidth, defaults.layout.leftWidth),
        rightWidth: toFiniteNumber(layoutAttributes.rightWidth, defaults.layout.rightWidth),
        bottomHeight: toFiniteNumber(layoutAttributes.bottomHeight, defaults.layout.bottomHeight),
      },
    };
    return appConfigState;
  } catch (error) {
    console.error("Unable to read XML app config:", error);
    appConfigState = defaults;
    return appConfigState;
  }
}

function serializeAppConfig(config) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<app-config>",
    `  <window width="${escapeXml(config.window.width)}" height="${escapeXml(config.window.height)}" x="${escapeXml(config.window.x ?? "")}" y="${escapeXml(config.window.y ?? "")}" isMaximized="${escapeXml(config.window.isMaximized)}" isFullScreen="${escapeXml(config.window.isFullScreen)}" />`,
    `  <layout leftWidth="${escapeXml(config.layout.leftWidth)}" rightWidth="${escapeXml(config.layout.rightWidth)}" bottomHeight="${escapeXml(config.layout.bottomHeight)}" />`,
    "</app-config>",
    "",
  ].join("\n");
}

function writeAppConfigSync(config) {
  const configPath = resolveConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, serializeAppConfig(config), "utf8");
}

function scheduleAppConfigWrite() {
  if (configWriteTimer) {
    clearTimeout(configWriteTimer);
  }

  configWriteTimer = setTimeout(() => {
    const snapshot = appConfigState ?? getDefaultAppConfig();
    const configPath = resolveConfigPath();
    const xml = serializeAppConfig(snapshot);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    configWritePromise = fs.promises.writeFile(configPath, xml, "utf8").catch((error) => {
      console.error("Unable to write XML app config:", error);
    });
  }, 900);
}

function mergeAppConfig(partialConfig) {
  const currentConfig = readAppConfig();
  appConfigState = {
    window: {
      ...currentConfig.window,
      ...(partialConfig.window ?? {}),
    },
    layout: {
      ...currentConfig.layout,
      ...(partialConfig.layout ?? {}),
    },
  };
  scheduleAppConfigWrite();
  return appConfigState;
}

function ensureAppConfigFile() {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    const defaults = getDefaultAppConfig();
    appConfigState = defaults;
    writeAppConfigSync(defaults);
  }
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
  const appConfig = readAppConfig();
  const windowOptions = {
    width: appConfig.window.width,
    height: appConfig.window.height,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#f3f5f7",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  if (Number.isFinite(appConfig.window.x) && Number.isFinite(appConfig.window.y)) {
    windowOptions.x = appConfig.window.x;
    windowOptions.y = appConfig.window.y;
  }

  const window = new BrowserWindow(windowOptions);

  let persistTimer = null;
  const persistWindowStateImmediate = () => {
    if (window.isMinimized() || window.isDestroyed()) {
      return;
    }

    const bounds = window.getNormalBounds();
    mergeAppConfig({
      window: {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: window.isMaximized(),
        isFullScreen: window.isFullScreen(),
      },
    });
  };

  const persistWindowState = () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
      persistWindowStateImmediate();
    }, 900);
  };

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  Menu.setApplicationMenu(buildAppMenu(window));

  if (appConfig.window.isMaximized) {
    window.maximize();
  }
  if (appConfig.window.isFullScreen) {
    window.setFullScreen(true);
  }

  window.on("resize", persistWindowState);
  window.on("move", persistWindowState);
  window.on("maximize", persistWindowState);
  window.on("unmaximize", persistWindowState);
  window.on("enter-full-screen", persistWindowState);
  window.on("leave-full-screen", persistWindowState);
  window.on("close", () => {
    if (configWriteTimer) {
      clearTimeout(configWriteTimer);
      configWriteTimer = null;
    }
    persistWindowStateImmediate();
    writeAppConfigSync(appConfigState ?? getDefaultAppConfig());
  });

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

ipcMain.handle("config:get", async () => {
  return readAppConfig();
});

ipcMain.handle("config:save-layout", async (_event, layout) => {
  const safeLayout = {
    leftWidth: toFiniteNumber(layout?.leftWidth, getDefaultAppConfig().layout.leftWidth),
    rightWidth: toFiniteNumber(layout?.rightWidth, getDefaultAppConfig().layout.rightWidth),
    bottomHeight: toFiniteNumber(layout?.bottomHeight, getDefaultAppConfig().layout.bottomHeight),
  };
  mergeAppConfig({ layout: safeLayout });
  return { stored: true };
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
  ensureAppConfigFile();
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
