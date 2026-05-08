const { spawn } = require("node:child_process");

function resolvePythonLaunch() {
  if (process.platform === "win32") {
    return { command: "py", prefixArgs: ["-3"] };
  }

  return { command: "python3", prefixArgs: [] };
}

function runProcess(command, args, cwd) {
  return runProcessWithEnv(command, args, cwd);
}

function runProcessWithEnv(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }

      resolve({ code, stdout, stderr, executedAt: new Date().toISOString() });
    });
  });
}

module.exports = {
  resolvePythonLaunch,
  runProcess,
  runProcessWithEnv,
};
