const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const nativeBinaryName = process.platform === "win32" ? "hello_logs.exe" : "hello_logs";

function assertPathExists(targetPath, description) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${description} is missing: ${targetPath}`);
  }
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function main() {
  const requiredFiles = [
    [path.join(projectRoot, "package.json"), "package manifest"],
    [path.join(projectRoot, "src", "main", "main.js"), "Electron main entrypoint"],
    [path.join(projectRoot, "src", "preload", "preload.js"), "Electron preload bridge"],
    [path.join(projectRoot, "src", "renderer", "index.html"), "main renderer HTML"],
    [path.join(projectRoot, "src", "renderer", "map.html"), "detached map renderer HTML"],
    [path.join(projectRoot, "scripts", "start-electron.js"), "Electron launcher script"],
    [path.join(projectRoot, "scripts", "fetch-inflation-data.py"), "inflation fetcher"],
    [path.join(projectRoot, "scripts", "fetch-market-map-data.py"), "market map fetcher"],
    [path.join(projectRoot, "native", "bin", nativeBinaryName), "compiled native binary"],
  ];

  for (const [targetPath, description] of requiredFiles) {
    assertPathExists(targetPath, description);
  }

  ensureDirectory(path.join(projectRoot, "assets"));
  ensureDirectory(path.join(projectRoot, "dist"));

  console.log("Build preparation complete.");
  console.log(`Verified native binary: native/bin/${nativeBinaryName}`);
  console.log("Verified Electron entrypoints, renderer files, and Python scripts.");
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
