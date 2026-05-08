const path = require("node:path");
const { app } = require("electron");

function resolveNativeBinary() {
  const extension = process.platform === "win32" ? ".exe" : "";
  return path.join(app.getAppPath(), "native", "bin", `hello_logs${extension}`);
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

module.exports = {
  resolveCentralBankDbPath,
  resolveConfigPath,
  resolveCredentialsDbPath,
  resolveEmploymentDbPath,
  resolveGrowthDbPath,
  resolveInflationDbPath,
  resolveMapsDirectory,
  resolveMarketMapDbPath,
  resolveNativeBinary,
  resolveRiskDbPath,
};
