const path = require("node:path");
const { spawn } = require("node:child_process");

const electronBinary = require("electron");
const projectRoot = path.resolve(__dirname, "..");
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_NO_SANDBOX = "1";

const child = spawn(electronBinary, ["--no-sandbox", "--disable-setuid-sandbox", projectRoot], {
  cwd: projectRoot,
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
