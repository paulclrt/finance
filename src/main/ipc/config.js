const { BrowserWindow, Menu } = require("electron");

function registerConfigIpc({
  ipcMain,
  readAppConfig,
  mergeAppConfig,
  getDefaultAppConfig,
  toFiniteNumber,
  DEFAULT_ENABLED_WIDGET_IDS,
  setEnabledWidgetIds,
  buildAppMenu,
  broadcastAppConfig,
}) {
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
}

module.exports = {
  registerConfigIpc,
};
