const path = require("node:path");
const { app, BrowserWindow, Menu, safeStorage, shell, dialog, ipcMain } = require("electron");
const { buildAppMenu: createAppMenu } = require("./app-menu");
const {
  DEFAULT_ENABLED_WIDGET_IDS,
  WIDGET_MENU_GROUPS,
  ensureAppConfigFile,
  ensureMapsDirectory,
  flushPendingConfigWrite,
  getDefaultAppConfig,
  mergeAppConfig,
  parseEnabledWidgetIds,
  readAppConfig,
  setEnabledWidgetIds,
  toFiniteNumber,
  unescapeXml,
  writeAppConfigSync,
  listMapConfigFiles,
} = require("./app-config");
const { createCredentialsService } = require("./credentials-service");
const { registerIpcHandlers } = require("./ipc/register");
const {
  resolveCentralBankDbPath,
  resolveCredentialsDbPath,
  resolveEmploymentDbPath,
  resolveGrowthDbPath,
  resolveInflationDbPath,
  resolveMapsDirectory,
  resolveMarketMapDbPath,
  resolveNativeBinary,
  resolveRiskDbPath,
} = require("./paths");
const { resolvePythonLaunch, runProcess, runProcessWithEnv } = require("./process-runner");
const fs = require("node:fs");

app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-setuid-sandbox");

let mapWindowRef = null;
const { encryptField, getDecryptedCredential, getFredApiKey, runCredentialsStore } = createCredentialsService({
  safeStorage,
});

function broadcastAppConfig(mainWindow) {
  if (!mainWindow?.webContents || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("ui:app-config-updated", readAppConfig());
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

  mapWindowRef.loadFile(path.join(__dirname, "..", "windows", "map", "index.html"));
  return mapWindowRef;
}

function buildAppMenu(mainWindow) {
  const enabledWidgetIds = parseEnabledWidgetIds();
  return createAppMenu({
    enabledWidgetIds,
    widgetGroups: WIDGET_MENU_GROUPS,
    onOpenCredentials: () => {
      mainWindow.webContents.send("ui:open-credentials");
    },
    onOpenMapWindow: () => {
      openMapWindow();
    },
    onResetLayout: () => {
      resetAppLayout(mainWindow);
    },
    onToggleWidget: (widgetId, isChecked) => {
      toggleWidgetInMenu(mainWindow, widgetId, isChecked);
    },
  });
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
    flushPendingConfigWrite();
    persistWindowStateImmediate();
    writeAppConfigSync(readAppConfig() ?? getDefaultAppConfig());
  });

  return window;
}

registerIpcHandlers({
  DEFAULT_ENABLED_WIDGET_IDS,
  app,
  broadcastAppConfig,
  buildAppMenu,
  dialog,
  encryptField,
  ensureMapsDirectory,
  fs,
  getDefaultAppConfig,
  getDecryptedCredential,
  getFredApiKey,
  ipcMain,
  listMapConfigFiles,
  mergeAppConfig,
  readAppConfig,
  resolveCentralBankDbPath,
  resolveCredentialsDbPath,
  resolveEmploymentDbPath,
  resolveGrowthDbPath,
  resolveInflationDbPath,
  resolveMapsDirectory,
  resolveMarketMapDbPath,
  resolveNativeBinary,
  resolvePythonLaunch,
  resolveRiskDbPath,
  runCredentialsStore,
  runProcess,
  runProcessWithEnv,
  safeStorage,
  setEnabledWidgetIds,
  shell,
  toFiniteNumber,
  unescapeXml,
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
