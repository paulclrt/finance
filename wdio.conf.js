const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const electronBinary = require("electron");

const testOutputDir = path.join(__dirname, ".tmp", "wdio-user-data");
const wdioArtifactsDir = path.join(__dirname, ".tmp", "wdio-artifacts");
const screenshotDir = path.join(wdioArtifactsDir, "screenshots");
const projectRoot = __dirname;
const chromedriverBinary = path.join(
  __dirname,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "chromedriver.cmd" : "chromedriver"
);

process.env.FINANCELAB_TEST_MODE = "1";
process.env.FINANCELAB_TEST_OUTPUT_DIR = testOutputDir;

fs.rmSync(testOutputDir, { recursive: true, force: true });
fs.mkdirSync(testOutputDir, { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

const originalNetworkInterfaces = os.networkInterfaces.bind(os);
os.networkInterfaces = () => {
  try {
    return originalNetworkInterfaces();
  } catch {
    return {
      lo: [
        {
          address: "127.0.0.1",
          family: "IPv4",
          internal: true,
        },
      ],
    };
  }
};

exports.config = {
  runner: "local",
  specs: ["./tests/e2e/specs/**/*.e2e.js"],
  maxInstances: 1,
  logLevel: "warn",
  outputDir: wdioArtifactsDir,
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
  services: ["electron"],
  capabilities: [
    {
      browserName: "electron",
      maxInstances: 1,
      browserVersion: "41.0.3",
      "goog:chromeOptions": {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      },
      "wdio:chromedriverOptions": {
        binary: chromedriverBinary,
      },
      "wdio:electronServiceOptions": {
        appBinaryPath: electronBinary,
        appArgs: [projectRoot],
      },
    },
  ],
  before() {
    browser.setTimeout({ implicit: 1000, pageLoad: 20000, script: 30000 });
  },
  async afterTest(test, _context, { error }) {
    if (!error) {
      return;
    }

    const safeTitle = `${test.parent || "suite"}-${test.title || "test"}`
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const filePath = path.join(screenshotDir, `${Date.now()}-${safeTitle}.png`);
    await browser.saveScreenshot(filePath);
  },
  onComplete() {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  },
};
