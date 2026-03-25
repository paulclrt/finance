const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const sourceFile = path.join(projectRoot, "native", "src", "hello_logs.c");
const outputDir = path.join(projectRoot, "native", "bin");
const binaryName = process.platform === "win32" ? "hello_logs.exe" : "hello_logs";
const outputFile = path.join(outputDir, binaryName);

fs.mkdirSync(outputDir, { recursive: true });

const compilerCandidates = process.platform === "win32" ? ["gcc", "clang"] : ["cc", "gcc", "clang"];

let buildResult = null;

for (const compiler of compilerCandidates) {
  const result = spawnSync(compiler, [sourceFile, "-O2", "-Wall", "-Wextra", "-o", outputFile], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.error && result.error.code === "ENOENT") {
    continue;
  }

  buildResult = { compiler, result };
  break;
}

if (!buildResult) {
  console.error("No C compiler found. Install gcc, clang, or cc to build native modules.");
  process.exit(1);
}

if (buildResult.result.status !== 0) {
  process.stderr.write(buildResult.result.stderr || "");
  process.exit(buildResult.result.status || 1);
}

console.log(`Built native binary with ${buildResult.compiler}: ${outputFile}`);
