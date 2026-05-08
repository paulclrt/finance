const path = require("node:path");
const { app } = require("electron");
const { resolveCredentialsDbPath } = require("./paths");
const { resolvePythonLaunch, runProcess } = require("./process-runner");

function createCredentialsService({ safeStorage }) {
  async function runCredentialsStore(args) {
    const { command, prefixArgs } = resolvePythonLaunch();
    const scriptPath = path.join(app.getAppPath(), "scripts", "credentials-store.py");
    return runProcess(command, [...prefixArgs, scriptPath, ...args], app.getAppPath());
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

  return {
    decryptField,
    encryptField,
    getDecryptedCredential,
    getFredApiKey,
    runCredentialsStore,
  };
}

module.exports = {
  createCredentialsService,
};
