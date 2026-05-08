function registerCredentialsIpc({
  ipcMain,
  safeStorage,
  resolveCredentialsDbPath,
  runCredentialsStore,
  getDecryptedCredential,
  encryptField,
}) {
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
}

module.exports = {
  registerCredentialsIpc,
};
