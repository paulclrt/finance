const assert = require("node:assert/strict");
const {
  buildTabbedLayout,
  reloadApp,
  resetState,
  saveWidgetsConfig,
  waitForMainShell,
  waitForWidget,
  waitForWidgetCount,
} = require("../helpers/app.js");

describe("workspace", () => {
  beforeEach(async () => {
    await resetState();
    await reloadApp();
    await waitForMainShell();
  });

  it("loads the default research workspace", async () => {
    await waitForWidget("centralBank");
    await waitForWidget("inflation");
    await waitForWidgetCount(2);

    await $("h2=Fed / ECB policy monitor").waitForDisplayed();
    await $("h2=CPI / PCE / HICP").waitForDisplayed();

    const topbarText = await $("[data-topbar-meta]").getText();
    assert.match(topbarText, /2 widgets/);
  });

  it("can enable additional market widgets deterministically", async () => {
    await saveWidgetsConfig({
      enabled: ["centralBank", "inflation", "ticker", "fx"],
    });

    await waitForWidget("ticker");
    await waitForWidget("fx");
    await waitForWidgetCount(4);

    await $("h2=Stock Ticker").waitForDisplayed();
    await $("h2=FX monitor").waitForDisplayed();
  });

  it("persists a closed widget across reloads", async () => {
    await $('button[data-close-widget="inflation"]').click();
    await browser.waitUntil(async () => !(await $('[data-widget-tile="inflation"]').isExisting()), {
      timeout: 10000,
      timeoutMsg: "Inflation widget should be removed",
    });

    await reloadApp();
    await waitForWidget("centralBank");
    await waitForWidgetCount(1);
    assert.equal(await $('[data-widget-tile="inflation"]').isExisting(), false);
  });

  it("supports tab layouts and undocking", async () => {
    await saveWidgetsConfig({
      enabled: ["centralBank", "inflation"],
      layout: buildTabbedLayout(["centralBank", "inflation"], "centralBank"),
    });

    await $(".widget-tabs").waitForDisplayed();
    await $('[data-tab-widget="inflation"]').click();
    await $('[data-tab-widget="inflation"].active').waitForDisplayed();

    await $('[data-undock-widget="inflation"]').click();
    await waitForWidgetCount(2);
  });
});
