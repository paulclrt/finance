const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("financeDesktop", {
  runNativeHello: () => ipcRenderer.invoke("native:run-hello"),
  getCentralBankEvents: (options) => ipcRenderer.invoke("data:get-central-bank-events", options),
  getTickerData: (options) => ipcRenderer.invoke("data:get-ticker-data", options),
  getInflationData: (options) => ipcRenderer.invoke("data:get-inflation-data", options),
  getRiskData: (options) => ipcRenderer.invoke("data:get-risk-data", options),
  getEmploymentData: (options) => ipcRenderer.invoke("data:get-employment-data", options),
  getGrowthData: (options) => ipcRenderer.invoke("data:get-growth-data", options),
  listMapConfigs: () => ipcRenderer.invoke("maps:list-configs"),
  importMapConfig: () => ipcRenderer.invoke("maps:import-config"),
  deleteMapConfig: (fileName) => ipcRenderer.invoke("maps:delete-config", fileName),
  getMapData: (options) => ipcRenderer.invoke("maps:get-data", options),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  listCredentials: () => ipcRenderer.invoke("credentials:list"),
  getCredential: (serviceKey) => ipcRenderer.invoke("credentials:get", serviceKey),
  saveCredential: (payload) => ipcRenderer.invoke("credentials:save", payload),
  deleteCredential: (serviceKey) => ipcRenderer.invoke("credentials:delete", serviceKey),
  getCredentialStatus: () => ipcRenderer.invoke("credentials:status"),
  getAppConfig: () => ipcRenderer.invoke("config:get"),
  saveLayoutConfig: (layout) => ipcRenderer.invoke("config:save-layout", layout),
  saveWidgetsConfig: (widgets) => ipcRenderer.invoke("config:save-widgets", widgets),
  onOpenCredentials: (callback) => {
    ipcRenderer.removeAllListeners("ui:open-credentials");
    ipcRenderer.on("ui:open-credentials", () => callback());
  },
  onAppConfigUpdated: (callback) => {
    ipcRenderer.removeAllListeners("ui:app-config-updated");
    ipcRenderer.on("ui:app-config-updated", (_event, config) => callback(config));
  },
  stylesheetExists: (stylesheetPath) => ipcRenderer.invoke("fs:check-file-exists", stylesheetPath),
});
