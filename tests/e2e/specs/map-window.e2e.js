const assert = require("node:assert/strict");
const {
  openMapWindow,
  reloadApp,
  resetState,
  switchToNewestWindow,
  waitForMainShell,
} = require("../helpers/app.js");

describe("market map window", () => {
  beforeEach(async () => {
    await resetState();
    await reloadApp();
    await waitForMainShell();
  });

  it("opens the detached market map and renders tiles", async () => {
    const mainHandle = await browser.getWindowHandle();
    await openMapWindow();
    await switchToNewestWindow();

    await $("h1=Maps").waitForDisplayed();
    await $('[data-map-file="us-mega-caps.xml"]').waitForDisplayed();
    await browser.waitUntil(async () => (await $$(".map-node.map-ticker")).length >= 3, {
      timeout: 10000,
      timeoutMsg: "Expected treemap ticker nodes",
    });

    const statusText = await $("[data-map-status]").getText();
    assert.match(statusText, /symbols/i);

    await browser.closeWindow();
    await browser.switchToWindow(mainHandle);
  });

  it("switches market map duration without losing content", async () => {
    const mainHandle = await browser.getWindowHandle();
    await openMapWindow();
    await switchToNewestWindow();

    await $('[data-map-duration="1y"]').click();
    const durationButton = await $('[data-map-duration="1y"]');
    assert.match(await durationButton.getAttribute("class"), /active/);
    await browser.waitUntil(async () => (await $$(".map-node.map-ticker")).length >= 3, {
      timeout: 10000,
      timeoutMsg: "Expected treemap ticker nodes after duration change",
    });

    await browser.closeWindow();
    await browser.switchToWindow(mainHandle);
  });
});
