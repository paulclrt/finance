const path = require("node:path");

function registerMapsIpc({
  ipcMain,
  app,
  fs,
  dialog,
  listMapConfigFiles,
  ensureMapsDirectory,
  readAppConfig,
  mergeAppConfig,
  resolveMapsDirectory,
  resolveMarketMapDbPath,
  resolvePythonLaunch,
  runProcess,
  unescapeXml,
}) {
  ipcMain.handle("maps:list-configs", async () => {
    return listMapConfigFiles();
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
    const xml = fs.readFileSync(targetPath, "utf8");
    const titleMatch = xml.match(/<map[^>]+(?:title|name)="([^"]+)"/i);
    const title = unescapeXml(titleMatch?.[1] || targetName.replace(/\.xml$/i, ""));

    let customEntries = [];
    try {
      customEntries = JSON.parse(readAppConfig()?.maps?.custom || "[]");
    } catch {
      customEntries = [];
    }

    const nextEntries = [
      ...customEntries.filter((entry) => String(entry?.fileName || "").trim() !== targetName),
      { fileName: targetName, title, sourcePath },
    ];

    mergeAppConfig({
      maps: {
        selected: targetName,
        custom: JSON.stringify(nextEntries),
      },
    });

    return { imported: true, fileName: targetName, title };
  });

  ipcMain.handle("maps:delete-config", async (_event, fileNameValue) => {
    const fileName = String(fileNameValue || "").trim();
    if (!fileName) {
      throw new Error("Map config file is required.");
    }

    let customEntries = [];
    try {
      customEntries = JSON.parse(readAppConfig()?.maps?.custom || "[]");
    } catch {
      customEntries = [];
    }

    const targetEntry = customEntries.find((entry) => String(entry?.fileName || "").trim() === fileName);
    if (!targetEntry) {
      throw new Error(`Custom map '${fileName}' was not found.`);
    }

    const targetPath = path.join(resolveMapsDirectory(), fileName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    const nextEntries = customEntries.filter((entry) => String(entry?.fileName || "").trim() !== fileName);
    const available = listMapConfigFiles();
    const nextSelected =
      readAppConfig()?.maps?.selected === fileName
        ? nextEntries[0]?.fileName || available.groups.default[0]?.fileName || ""
        : readAppConfig()?.maps?.selected || "";

    mergeAppConfig({
      maps: {
        selected: nextSelected,
        custom: JSON.stringify(nextEntries),
      },
    });

    return { deleted: true, fileName, selectedFile: nextSelected };
  });

  ipcMain.handle("maps:get-data", async (_event, options = {}) => {
    const fileName = String(options?.fileName || "").trim();
    if (!fileName) {
      throw new Error("Map config file is required.");
    }

    const availableMaps = listMapConfigFiles();
    const flatMaps = [...availableMaps.groups.default, ...availableMaps.groups.custom];
    const selected = flatMaps.find((item) => item.fileName === fileName || item.id === fileName);
    if (!selected || !selected.exists) {
      throw new Error(`Map config '${fileName}' was not found.`);
    }

    mergeAppConfig({
      maps: {
        selected: selected.fileName,
      },
    });

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
}

module.exports = {
  registerMapsIpc,
};
