const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("financeDesktop", {
  runNativeHello: () => ipcRenderer.invoke("native:run-hello"),
  getCentralBankEvents: (options) => ipcRenderer.invoke("data:get-central-bank-events", options),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
});
