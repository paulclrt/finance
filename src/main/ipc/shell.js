function registerShellIpc({ ipcMain, shell }) {
  ipcMain.handle("shell:open-external", async (_event, url) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
      throw new Error("Only http(s) urls can be opened.");
    }

    await shell.openExternal(url);
  });
}

module.exports = {
  registerShellIpc,
};
