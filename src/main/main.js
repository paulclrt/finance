const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, Menu, shell, safeStorage, dialog } = require("electron");
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

function resolveInflationDbPath() {
  return path.join(app.getPath("userData"), "data", "inflation.sqlite3");
}

function resolveRiskDbPath() {
  return path.join(app.getPath("userData"), "data", "risk.sqlite3");
}

function resolveEmploymentDbPath() {
  return path.join(app.getPath("userData"), "data", "employment.sqlite3");
}

function resolveGrowthDbPath() {
  return path.join(app.getPath("userData"), "data", "growth.sqlite3");
}

function resolveMarketMapDbPath() {
  return path.join(app.getPath("userData"), "data", "market-map.sqlite3");
}

function resolveMapsDirectory() {
  return path.join(app.getPath("userData"), "maps");
}

function resolveConfigPath() {
  return path.join(app.getPath("userData"), "config", "app-state.xml");
}

let appConfigState = null;
let configWriteTimer = null;
let configWritePromise = null;
let mapWindowRef = null;

const SAMPLE_MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<map title="US Mega Caps">
  <group label="Technology">
    <ticker symbol="AAPL" label="Apple" />
    <ticker symbol="MSFT" label="Microsoft" />
    <ticker symbol="NVDA" label="NVIDIA" />
    <ticker symbol="GOOGL" label="Alphabet" />
    <ticker symbol="META" label="Meta" />
  </group>
  <group label="Consumer">
    <ticker symbol="AMZN" label="Amazon" />
    <ticker symbol="TSLA" label="Tesla" />
    <ticker symbol="WMT" label="Walmart" />
    <ticker symbol="COST" label="Costco" />
  </group>
  <group label="Finance">
    <ticker symbol="JPM" label="JPMorgan" />
    <ticker symbol="BAC" label="Bank of America" />
    <ticker symbol="V" label="Visa" />
    <ticker symbol="MA" label="Mastercard" />
  </group>
  <group label="Healthcare">
    <ticker symbol="LLY" label="Eli Lilly" />
    <ticker symbol="JNJ" label="Johnson &amp; Johnson" />
    <ticker symbol="UNH" label="UnitedHealth" />
  </group>
</map>
`;

const WIDGET_MENU_GROUPS = [
  {
    id: "policy",
    label: "Politique monetaire",
    items: [
      {
        id: "centralBank",
        title: "Central Banks",
        description: "Fed and ECB key rates, calendar and policy path.",
      },
      {
        id: "yieldCurve",
        title: "Yield Curve",
        description: "US Treasuries 2Y, 10Y and 30Y. The 2Y/10Y inversion is a classic recession signal.",
      },
      {
        id: "fedFundsFutures",
        title: "Fed Funds Futures",
        description: "Market-implied view of what the Fed is expected to do next.",
      },
      {
        id: "balanceSheet",
        title: "Balance Sheet",
        description: "Fed and ECB balance sheet expansion or contraction for QE and QT tracking.",
      },
    ],
  },
  {
    id: "macro",
    label: "Macro reelle",
    items: [
      { id: "inflation", title: "Inflation", description: "CPI, PCE and HICP inflation tracking." },
      { id: "employment", title: "Employment", description: "NFP, unemployment and JOLTS labor market indicators." },
      { id: "growth", title: "Growth", description: "GDP, ISM and PMIs to monitor the cycle." },
      {
        id: "surpriseIndex",
        title: "Surprise Index",
        description: "Economic surprise gauge to explain market reactions versus expectations.",
      },
    ],
  },
  {
    id: "markets",
    label: "Marches financiers",
    items: [
      { id: "ticker", title: "Stock & Funds", description: "Explore Stocks and fund value over time"},
      { id: "equities", title: "Equities", description: "S&P 500, Nasdaq and Euro Stoxx 50 market dashboard." },
      { id: "fx", title: "FX", description: "DXY, EUR/USD and USD/JPY foreign-exchange monitor." },
      { id: "commodities", title: "Commodities", description: "WTI, Brent, Gold and Copper as global macro barometers." },
      {
        id: "creditSpreads",
        title: "Credit Spreads",
        description: "Investment grade versus high yield spread stress monitor.",
      },
    ],
  },
  {
    id: "risk",
    label: "Sentiment et risque",
    items: [
      {
        id: "risk",
        title: "Sentiment & Risk",
        description: "VIX, bond volatility, put/call ratio and fear versus greed.",
      },
    ],
  },
  {
    id: "correlations",
    label: "Correlations et causalite",
    items: [
      {
        id: "correlations",
        title: "Correlations Graph",
        description: "Dependency map between policy, rates, FX, gold, equities and banks.",
      },
    ],
  },
];

const DEFAULT_ENABLED_WIDGET_IDS = ["centralBank", "inflation"];

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
      rightWidth: 32,
      bottomHeight: 44,
    },
    widgets: {
      enabled: "centralBank,inflation",
      layout: "",
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

function unescapeXml(value) {
  return String(value ?? "")
    .replaceAll("&quot;", "\"")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function parseTagAttributes(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}\\s+([^>]+?)\\s*\\/?>`, "i"));
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    [...match[1].matchAll(/([a-zA-Z0-9_:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, unescapeXml(value)]),
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
    const widgetAttributes = parseTagAttributes(xml, "widgets");

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
      widgets: {
        enabled: widgetAttributes.enabled || defaults.widgets.enabled,
        layout: widgetAttributes.layout || defaults.widgets.layout,
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
    `  <widgets enabled="${escapeXml(config.widgets.enabled)}" layout="${escapeXml(config.widgets.layout ?? "")}" />`,
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
    widgets: {
      ...currentConfig.widgets,
      ...(partialConfig.widgets ?? {}),
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

function ensureMapsDirectory() {
  const mapsDirectory = resolveMapsDirectory();
  fs.mkdirSync(mapsDirectory, { recursive: true });
  const samplePath = path.join(mapsDirectory, "us-mega-caps.xml");
  if (!fs.existsSync(samplePath)) {
    fs.writeFileSync(samplePath, SAMPLE_MAP_XML, "utf8");
  }
}

function listMapConfigFiles() {
  ensureMapsDirectory();
  return fs
    .readdirSync(resolveMapsDirectory(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xml"))
    .map((entry) => {
      const fullPath = path.join(resolveMapsDirectory(), entry.name);
      const xml = fs.readFileSync(fullPath, "utf8");
      const titleMatch = xml.match(/<map[^>]+(?:title|name)="([^"]+)"/i);
      return {
        id: entry.name,
        fileName: entry.name,
        title: titleMatch?.[1] || entry.name.replace(/\.xml$/i, ""),
        path: fullPath,
      };
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function parseEnabledWidgetIds(config = readAppConfig()) {
  const allowed = new Set(WIDGET_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.id)));
  const rawEnabled = config?.widgets?.enabled;
  if (rawEnabled === "") {
    return [];
  }

  const enabled = String(rawEnabled || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && allowed.has(item));

  return enabled.length ? enabled : [...DEFAULT_ENABLED_WIDGET_IDS];
}

function setEnabledWidgetIds(widgetIds) {
  const normalized = [...new Set(widgetIds.map((item) => String(item || "").trim()).filter(Boolean))];
  mergeAppConfig({
    widgets: {
      enabled: normalized.join(","),
    },
  });
  return normalized;
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

async function getFredApiKey() {
  const credential =
    (await getDecryptedCredential("fredapikey")) ||
    (await getDecryptedCredential("fred")) ||
    (await getDecryptedCredential("FRED"));

  const apiKey = String(credential?.apiKey || credential?.password || "").trim();
  if (!apiKey) {
    throw new Error("Missing FRED API key. Save it in Settings > Credentials under service key 'fredapikey'.");
  }

  return apiKey;
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

function broadcastAppConfig(mainWindow) {
  if (!mainWindow?.webContents || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("ui:app-config-updated", readAppConfig());
}

function checkFileExists(filePath) {
  
}

function toggleWidgetInMenu(mainWindow, widgetId, nextChecked) {
  const enabled = parseEnabledWidgetIds();
  const nextEnabled = nextChecked
    ? [...enabled, widgetId]
    : enabled.filter((item) => item !== widgetId);

  setEnabledWidgetIds(nextEnabled);
  Menu.setApplicationMenu(buildAppMenu(mainWindow));
  broadcastAppConfig(mainWindow);
}

function resetAppLayout(mainWindow) {
  mergeAppConfig({
    layout: {
      rightWidth: getDefaultAppConfig().layout.rightWidth,
      bottomHeight: getDefaultAppConfig().layout.bottomHeight,
    },
    widgets: {
      enabled: DEFAULT_ENABLED_WIDGET_IDS.join(","),
    },
  });
  Menu.setApplicationMenu(buildAppMenu(mainWindow));
  broadcastAppConfig(mainWindow);
}

function openMapWindow() {
  if (mapWindowRef && !mapWindowRef.isDestroyed()) {
    mapWindowRef.focus();
    return mapWindowRef;
  }

  mapWindowRef = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#f3f5f7",
    autoHideMenuBar: false,
    title: "Market Map",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mapWindowRef.on("closed", () => {
    mapWindowRef = null;
  });

  mapWindowRef.loadFile(path.join(__dirname, "..", "renderer", "map.html"));
  return mapWindowRef;
}

function buildAppMenu(mainWindow) {
  const template = [];
  const enabledWidgetIds = parseEnabledWidgetIds();

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
      {
        label: "Reset Layout",
        click: () => {
          resetAppLayout(mainWindow);
        },
      },
    ],
  });

  template.push({
    label: "Compte",
    submenu: [
      {
        label: "Local Profile",
        enabled: false,
        toolTip: "App state, layout and credentials stay local by default.",
      },
    ],
  });

  template.push({
    label: "Windows",
    submenu: [
      ...WIDGET_MENU_GROUPS.map((group) => ({
        label: group.label,
        submenu: group.items.map((item) => ({
          label: item.title,
          type: "checkbox",
          checked: enabledWidgetIds.includes(item.id),
          toolTip: item.description,
          click: (menuItem) => {
            toggleWidgetInMenu(mainWindow, item.id, menuItem.checked);
          },
        })),
      })),
      { type: "separator" },
      {
        label: "Open Map Window",
        click: () => {
          openMapWindow();
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

  template.push({
    label: "Soutenir",
    submenu: [
      {
        label: "GitHub",
        click: async () => {
          await shell.openExternal("https://github.com/paulclrt/finance");
        },
      },
      {
        label: "Author Website",
        click: async () => {
          await shell.openExternal("https://portfolio.paul-claret.fr");
        },
      },
    ],
  });

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

ipcMain.handle("data:get-ticker-data", async (_event, options = {}) => {
  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-ticker.py");
  const dbPath = path.join(app.getPath("userData"), "data", "ticker.sqlite3");
  const dbDirectory = path.dirname(dbPath);
  const { command, prefixArgs } = resolvePythonLaunch();

  fs.mkdirSync(dbDirectory, { recursive: true });

  const args = [...prefixArgs, scriptPath, "--db", dbPath, "--ticker", options.ticker || "AAPL", "--duration", options.duration || "1mo"];
  if (options?.refresh) {
    args.push("--refresh");
  }

  const result = await runProcess(command, args, app.getAppPath());
  return JSON.parse(result.stdout);
});

ipcMain.handle("data:get-inflation-data", async (_event, options = {}) => {
  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-inflation-data.py");
  const dbPath = resolveInflationDbPath();
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

ipcMain.handle("data:get-employment-data", async (_event, options = {}) => {
  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-employment-data.py");
  const dbPath = resolveEmploymentDbPath();
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

ipcMain.handle("data:get-growth-data", async (_event, options = {}) => {
  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-growth-data.py");
  const dbPath = resolveGrowthDbPath();
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

ipcMain.handle("config:save-widgets", async (_event, widgets) => {
  const mainWindow = BrowserWindow.fromWebContents(_event.sender);
  const enabled = Array.isArray(widgets?.enabled)
    ? widgets.enabled.map((item) => String(item || "").trim()).filter(Boolean)
    : [...DEFAULT_ENABLED_WIDGET_IDS];
  setEnabledWidgetIds(enabled);
  if (typeof widgets?.layout === "string") {
    mergeAppConfig({
      widgets: {
        layout: widgets.layout,
      },
    });
  }
  if (mainWindow) {
    Menu.setApplicationMenu(buildAppMenu(mainWindow));
    broadcastAppConfig(mainWindow);
  }
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

ipcMain.handle("fs:check-file-exists", async (_event, filePath) => {
  const sourceFile = path.join(__dirname, "renderer", filePath);
  return fs.existsSync(sourceFile);
});

ipcMain.handle("maps:list-configs", async () => {
  return listMapConfigFiles().map(({ id, fileName, title }) => ({ id, fileName, title }));
});

ipcMain.handle("maps:import-config", async () => {
  ensureMapsDirectory();
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "XML files", extensions: ["xml"] }],
  });

  if (result.canceled || !result.filePaths?.length) {
    return { imported: false };
  }

  const sourcePath = result.filePaths[0];
  const baseName = path.basename(sourcePath);
  let targetName = baseName;
  let targetPath = path.join(resolveMapsDirectory(), targetName);
  let suffix = 1;
  while (fs.existsSync(targetPath)) {
    targetName = `${baseName.replace(/\.xml$/i, "")}-${suffix}.xml`;
    targetPath = path.join(resolveMapsDirectory(), targetName);
    suffix += 1;
  }

  fs.copyFileSync(sourcePath, targetPath);
  return { imported: true, fileName: targetName };
});

ipcMain.handle("maps:get-data", async (_event, options = {}) => {
  const fileName = String(options?.fileName || "").trim();
  if (!fileName) {
    throw new Error("Map config file is required.");
  }

  const availableMaps = listMapConfigFiles();
  const selected = availableMaps.find((item) => item.fileName === fileName || item.id === fileName);
  if (!selected) {
    throw new Error(`Map config '${fileName}' was not found.`);
  }

  const scriptPath = path.join(app.getAppPath(), "scripts", "fetch-market-map-data.py");
  const dbPath = resolveMarketMapDbPath();
  const dbDirectory = path.dirname(dbPath);
  const { command, prefixArgs } = resolvePythonLaunch();
  fs.mkdirSync(dbDirectory, { recursive: true });

  const args = [
    ...prefixArgs,
    scriptPath,
    "--db",
    dbPath,
    "--config",
    selected.path,
    "--duration",
    String(options?.duration || "6mo"),
  ];
  if (options?.refresh) {
    args.push("--refresh");
  }

  const result = await runProcess(command, args, app.getAppPath());
  return JSON.parse(result.stdout);
});



app.whenReady().then(() => {
  ensureAppConfigFile();
  ensureMapsDirectory();
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
